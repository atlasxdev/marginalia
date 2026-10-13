import { queryOptions } from "@tanstack/react-query";
import { getBrowserClient } from "./supabase/client";
import type { Conversation, ConversationHit, ConversationSummary, DocumentItem, EditableDocument, Pet, Space, StudyOverview } from "./types";

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

export const petQuery = queryOptions({
  queryKey: ["pet"],
  queryFn: () => getJson<Pet | null>("/api/pet"),
  staleTime: Infinity,
});

export const conversationSearchQuery = (q: string) =>
  queryOptions({
    queryKey: ["conversations", "search", q],
    queryFn: () => getJson<ConversationHit[]>(`/api/conversations/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 10_000,
  });

export const conversationQuery = (id: string) =>
  queryOptions({
    queryKey: ["conversations", id],
    queryFn: () => getJson<Conversation>(`/api/conversations/${id}`),
  });

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data, error } = await getBrowserClient().auth.getUser();
    // A missing or ended session means no user; anything else, like being offline, is a real error
    const signedOut = error && (error.status === 401 || error.status === 403 || error.name === "AuthSessionMissingError");
    if (error && !signedOut) throw error;
    return data.user;
  },
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

export const studyQuery = queryOptions({
  queryKey: ["study"],
  queryFn: () => getJson<StudyOverview>("/api/study"),
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
