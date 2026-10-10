import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Conversation, ConversationSummary, DocumentItem, Message, Source } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Reads run as the signed-in user, so row level security scopes every query.

export async function listDocuments(supabase: Supabase): Promise<DocumentItem[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, mime_type, size_bytes, status, error, chunk_count, created_at")
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
  }));
}

export async function listConversations(supabase: Supabase): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at }));
}

export async function getConversation(supabase: Supabase, id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at, messages(id, role, content, sources, created_at)")
    .eq("id", id)
    .order("created_at", { referencedTable: "messages", ascending: true })
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    title: data.title,
    updatedAt: data.updated_at,
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
