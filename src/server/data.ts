import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type {
  Action,
  Conversation,
  ConversationHit,
  ConversationSummary,
  DocumentItem,
  EditableDocument,
  Message,
  Source,
  Space,
} from "@/lib/types";
import { noteJsonPath } from "@/lib/note";
import { documentTitle } from "@/server/ingest";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Reads run as the signed-in user, so row level security scopes every query.

export async function listDocuments(supabase: Supabase): Promise<DocumentItem[]> {
  const { data, error } = await supabase
    .from("documents")
    // All columns, so this keeps working before the suggested_questions migration has run
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((d) => ({
    id: d.id,
    filename: d.filename,
    mimeType: d.mime_type,
    sizeBytes: d.size_bytes,
    status: d.status,
    error: d.error,
    chunkCount: d.chunk_count,
    createdAt: d.created_at,
    suggestedQuestions: d.suggested_questions ?? [],
  }));
}

// Only Markdown documents can be edited; the text comes from the original file in Storage.
export async function getEditableDocument(supabase: Supabase, id: string): Promise<EditableDocument | null> {
  const { data: doc } = await supabase
    .from("documents")
    .select("id, filename, mime_type, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!doc || doc.mime_type !== "text/markdown") return null;
  const storage = supabase.storage.from("documents");
  const [{ data: file }, { data: json }] = await Promise.all([storage.download(doc.storage_path), storage.download(noteJsonPath(doc.storage_path))]);
  if (!file) return null;
  // Uploaded Markdown, and notes written before the editor kept styles, have no JSON
  let note: EditableDocument["note"] = null;
  try {
    note = json ? JSON.parse(await json.text()) : null;
  } catch {}
  return { id: doc.id, title: documentTitle(doc.filename), content: await file.text(), note };
}

const SUMMARY = "id, title, updated_at, space_id, pinned, position";
// Before migration 0004 there's no pinned or position; read without them so the app keeps working
const LEGACY_SUMMARY = "id, title, updated_at, space_id";
const missingColumn = (e: { code?: string } | null) => e?.code === "42703";
type SummaryRow = { id: string; title: string; updated_at: string; space_id: string | null; pinned?: boolean; position?: number | null };
const toSummary = (c: SummaryRow): ConversationSummary => ({
  id: c.id,
  title: c.title,
  updatedAt: c.updated_at,
  spaceId: c.space_id,
  pinned: c.pinned ?? false,
  position: c.position ?? null,
});

export async function listConversations(supabase: Supabase): Promise<ConversationSummary[]> {
  const list = (columns: string) =>
    supabase.from("conversations").select(columns).order("updated_at", { ascending: false }).limit(200);
  let { data, error } = await list(SUMMARY);
  if (missingColumn(error)) ({ data, error } = await list(LEGACY_SUMMARY));
  if (error) throw error;
  return (data as unknown as SummaryRow[]).map(toSummary);
}

// Escapes LIKE wildcards so a search for "100%" means the text "100%"
const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Conversations whose title or messages contain `q`, newest first, with the matching line. */
export async function searchConversations(supabase: Supabase, q: string): Promise<ConversationHit[]> {
  const term = likeTerm(q);
  const run = (columns: string) =>
    Promise.all([
      supabase.from("conversations").select(columns).ilike("title", term).limit(30),
      supabase
        .from("messages")
        .select(`content, created_at, conversation:conversations!inner(${columns})`)
        .ilike("content", term)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);
  let [titles, messages] = await run(SUMMARY);
  if (missingColumn(titles.error)) [titles, messages] = await run(LEGACY_SUMMARY);
  if (titles.error) throw titles.error;
  if (messages.error) throw messages.error;

  const hits = new Map<string, ConversationHit>();
  for (const m of messages.data as unknown as { content: string; conversation: unknown }[]) {
    const c = m.conversation as unknown as SummaryRow;
    if (!hits.has(c.id)) hits.set(c.id, { ...toSummary(c), snippet: snippetAround(m.content, q) });
  }
  for (const c of titles.data as unknown as SummaryRow[]) {
    if (!hits.has(c.id)) hits.set(c.id, { ...toSummary(c), snippet: null });
  }
  return [...hits.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 30);
}

/** About a line of text around the first match, on word boundaries, without markdown symbols. */
function snippetAround(text: string, q: string) {
  const plain = text.replace(/[#*_`>[\]]+/g, "").replace(/\s+/g, " ").trim();
  const at = plain.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return plain.slice(0, 120);
  const start = Math.max(0, plain.lastIndexOf(" ", Math.max(0, at - 40)) + 1);
  const end = Math.min(plain.length, at + q.length + 70);
  return `${start > 0 ? "…" : ""}${plain.slice(start, end).trim()}${end < plain.length ? "…" : ""}`;
}

export async function getConversation(supabase: Supabase, id: string): Promise<Conversation | null> {
  const get = (columns: string) =>
    supabase
      .from("conversations")
      .select(`${columns}, space:spaces(id, name), messages(id, role, content, sources, created_at)`)
      .eq("id", id)
      .order("created_at", { referencedTable: "messages", ascending: true })
      .maybeSingle();
  let { data: row, error } = await get(SUMMARY);
  if (missingColumn(error)) ({ data: row, error } = await get(LEGACY_SUMMARY));
  if (error || !row) return null;
  // Built from a column list, so the row is typed here rather than inferred
  const data = row as unknown as SummaryRow & {
    space: { id: string; name: string } | null;
    messages: { id: string; role: Message["role"]; content: string; sources: unknown; created_at: string }[];
  };
  const space = data.space;
  const actions = await listActions(supabase, data.messages.map((m) => m.id));
  return {
    ...toSummary(data),
    space: space ? { id: space.id, name: space.name } : null,
    messages: data.messages.map(
      (m): Message => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources as Source[],
        createdAt: m.created_at,
        actions: actions.filter((a) => a.messageId === m.id),
      })
    ),
  };
}

export type ActionRow = {
  id: string;
  message_id: string | null;
  document_id?: string | null;
  space_id?: string | null;
  kind: string;
  payload: unknown;
  state: unknown;
  created_at: string;
};

export const toAction = (a: ActionRow): Action =>
  ({
    id: a.id,
    messageId: a.message_id,
    documentId: a.document_id ?? null,
    spaceId: a.space_id ?? null,
    kind: a.kind,
    payload: a.payload,
    state: a.state ?? {},
    createdAt: a.created_at,
  }) as Action;

// Empty until the actions migration has run, so conversations still load without it
async function listActions(supabase: Supabase, messageIds: string[]): Promise<Action[]> {
  if (messageIds.length === 0) return [];
  const { data, error } = await supabase
    .from("actions")
    .select("id, message_id, kind, payload, state, created_at")
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data as ActionRow[]).map(toAction);
}

const toSpace = (s: {
  id: string;
  name: string;
  instructions: string;
  updated_at: string;
  study_method?: Space["studyMethod"];
  space_documents: { document_id: string }[];
}): Space => ({
  id: s.id,
  name: s.name,
  instructions: s.instructions,
  documentIds: s.space_documents.map((d) => d.document_id),
  updatedAt: s.updated_at,
  studyMethod: s.study_method ?? "recall",
});

export async function listSpaces(supabase: Supabase): Promise<Space[]> {
  const { data, error } = await supabase
    .from("spaces")
    // All columns, so this works before the study migration adds study_method
    .select("*, space_documents(document_id)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map(toSpace);
}

export async function getSpace(supabase: Supabase, id: string): Promise<Space | null> {
  const { data, error } = await supabase
    .from("spaces")
    // All columns, so this works before the study migration adds study_method
    .select("*, space_documents(document_id)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toSpace(data);
}
