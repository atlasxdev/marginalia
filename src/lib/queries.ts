import { queryOptions } from "@tanstack/react-query";
import { getBrowserClient } from "./supabase/client";
import type { Conversation, ConversationSummary, DocumentItem, EditableDocument, Space } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Request failed.");
  return res.json();
}

export const documentsQuery = queryOptions({
  queryKey: ["documents"],
  queryFn: () => getJson<DocumentItem[]>("/api/documents"),
  // Poll while anything is still ingesting
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

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => (await getBrowserClient().auth.getUser()).data.user,
  staleTime: Infinity,
});

export const documentQuery = (id: string) =>
  queryOptions({
    queryKey: ["document", id],
    queryFn: () => getJson<EditableDocument>(`/api/documents/${id}`),
    // The editor keeps its own copy while open, so don't refetch underneath it
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

export const spacesQuery = queryOptions({
  queryKey: ["spaces"],
  queryFn: () => getJson<Space[]>("/api/spaces"),
});

export const spaceQuery = (id: string) =>
  queryOptions({
    queryKey: ["spaces", id],
    queryFn: () => getJson<Space>(`/api/spaces/${id}`),
  });
