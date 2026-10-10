import { queryOptions } from "@tanstack/react-query";
import type { Conversation, ConversationSummary, DocumentItem } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Request failed.");
  return res.json();
}

export const documentsQuery = queryOptions({
  queryKey: ["documents"],
  queryFn: () => getJson<DocumentItem[]>("/api/documents"),
  // Poll while anything is still ingesting. Supabase Realtime replaces this later.
  refetchInterval: (query) =>
    query.state.data?.some((d) => d.status === "pending" || d.status === "processing")
      ? 1500
      : false,
});

export const conversationsQuery = queryOptions({
  queryKey: ["conversations"],
  queryFn: () => getJson<ConversationSummary[]>("/api/conversations"),
});

export const conversationQuery = (id: string) =>
  queryOptions({
    queryKey: ["conversations", id],
    queryFn: () => getJson<Conversation>(`/api/conversations/${id}`),
  });
