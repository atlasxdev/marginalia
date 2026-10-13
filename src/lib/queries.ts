import { queryOptions } from "@tanstack/react-query";
import {
  getConversation,
  getEditableDocument,
  getPet,
  getSpace,
  getStudyOverview,
  listConversations,
  listDocuments,
  listSpaces,
  searchConversations,
} from "./data";
import { getBrowserClient } from "./supabase/client";

/* Reads go straight from the browser to Supabase, as the signed-in user, so
   row level security scopes them. A missing row is an error, like a 404. */
const sb = () => getBrowserClient();
const found = <T>(value: T | null, what: string): T => {
  if (value === null) throw new Error(`${what} not found.`);
  return value;
};

export const documentsQuery = queryOptions({
  queryKey: ["documents"],
  queryFn: () => listDocuments(sb()),
  // Poll while anything is still ingesting
  refetchInterval: (query) =>
    query.state.data?.some((d) => d.status === "pending" || d.status === "processing")
      ? 1500
      : false,
});

export const conversationsQuery = queryOptions({
  queryKey: ["conversations"],
  queryFn: () => listConversations(sb()),
});

export const petQuery = queryOptions({
  queryKey: ["pet"],
  queryFn: () => getPet(sb()),
  staleTime: Infinity,
});

export const conversationSearchQuery = (q: string) =>
  queryOptions({
    queryKey: ["conversations", "search", q],
    queryFn: () => searchConversations(sb(), q.trim().slice(0, 100)),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });

export const conversationQuery = (id: string) =>
  queryOptions({
    queryKey: ["conversations", id],
    queryFn: async () => found(await getConversation(sb(), id), "Conversation"),
  });

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data, error } = await sb().auth.getUser();
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
    queryFn: async () => found(await getEditableDocument(sb(), id), "Document"),
    // The editor keeps its own copy while open, so don't refetch underneath it
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

export const studyQuery = queryOptions({
  queryKey: ["study"],
  queryFn: () => getStudyOverview(sb()),
});

export const spacesQuery = queryOptions({
  queryKey: ["spaces"],
  queryFn: () => listSpaces(sb()),
});

export const spaceQuery = (id: string) =>
  queryOptions({
    queryKey: ["spaces", id],
    queryFn: async () => found(await getSpace(sb(), id), "Subject"),
  });
