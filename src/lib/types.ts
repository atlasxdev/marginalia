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
};

export type Conversation = ConversationSummary & {
  messages: Message[];
};

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
