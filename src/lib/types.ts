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
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  /** The space it was started in; null searches every document. */
  spaceId: string | null;
};

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
