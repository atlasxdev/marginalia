export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export type DocumentItem = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  error: string | null;
  chunkCount: number;
  createdAt: string;
  /** Questions this document can answer, offered on the new question page. */
  suggestedQuestions: string[];
};

// A Markdown document opened in the editor
export type EditableDocument = {
  id: string;
  title: string;
  content: string;
};

export type Source = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  headingPath: string;
  excerpt: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  createdAt: string;
  /** Things made from this answer, oldest first. */
  actions: Action[];
};

export type ActionKind = "checklist" | "calendar" | "email" | "flashcards";

export type ChecklistItem = {
  text: string;
  /** As written in the document, like "by 5 March". */
  due: string | null;
  /** The chunk it came from. */
  sourceId: string | null;
};

export type Action = {
  id: string;
  messageId: string;
  createdAt: string;
} & {
  kind: "checklist";
  payload: { title: string; items: ChecklistItem[] };
  /** Indexes of ticked items. */
  state: { done?: number[] };
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  /** The space it was started in; null searches every document. */
  spaceId: string | null;
  pinned: boolean;
  /** Manual order, lower first; null until you reorder. */
  position: number | null;
};

/** A conversation found by search, with the line that matched. */
export type ConversationHit = ConversationSummary & { snippet: string | null };

export type Conversation = ConversationSummary & {
  space: { id: string; name: string } | null;
  messages: Message[];
};

// A named set of documents with optional instructions for its answers
export type Space = {
  id: string;
  name: string;
  instructions: string;
  documentIds: string[];
  updatedAt: string;
};

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

/** Your pet, and when it was last fed, played with and put to bed (its needs wear down from those). */
export type Pet = import("./pet-art").PetLook & {
  name: string;
  fedAt: string;
  playedAt: string;
  sleptAt: string;
  xp: number;
};
