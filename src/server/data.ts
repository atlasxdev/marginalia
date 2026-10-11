import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type {
  Conversation,
  ConversationSummary,
  DocumentItem,
  EditableDocument,
  Message,
  Source,
  Space,
} from "@/lib/types";
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
  const { data: file } = await supabase.storage.from("documents").download(doc.storage_path);
  if (!file) return null;
  return { id: doc.id, title: documentTitle(doc.filename), content: await file.text() };
}

export async function listConversations(supabase: Supabase): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at, space_id")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at, spaceId: c.space_id }));
}

export async function getConversation(supabase: Supabase, id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at, space_id, space:spaces(id, name), messages(id, role, content, sources, created_at)")
    .eq("id", id)
    .order("created_at", { referencedTable: "messages", ascending: true })
    .maybeSingle();
  if (error || !data) return null;
  // A many-to-one embed comes back as one object; without generated types it's typed as an array
  const space = data.space as unknown as { id: string; name: string } | null;
  return {
    id: data.id,
    title: data.title,
    updatedAt: data.updated_at,
    spaceId: data.space_id,
    space: space ? { id: space.id, name: space.name } : null,
    messages: data.messages.map(
      (m): Message => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources as Source[],
        createdAt: m.created_at,
      })
    ),
  };
}

const toSpace = (s: {
  id: string;
  name: string;
  instructions: string;
  updated_at: string;
  space_documents: { document_id: string }[];
}): Space => ({
  id: s.id,
  name: s.name,
  instructions: s.instructions,
  documentIds: s.space_documents.map((d) => d.document_id),
  updatedAt: s.updated_at,
});

export async function listSpaces(supabase: Supabase): Promise<Space[]> {
  const { data, error } = await supabase
    .from("spaces")
    .select("id, name, instructions, updated_at, space_documents(document_id)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map(toSpace);
}

export async function getSpace(supabase: Supabase, id: string): Promise<Space | null> {
  const { data, error } = await supabase
    .from("spaces")
    .select("id, name, instructions, updated_at, space_documents(document_id)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toSpace(data);
}
