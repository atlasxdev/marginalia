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

export type Flashcard = {
  front: string;
  back: string;
  /** The concept it tests, like "Krebs cycle", for finding weak topics. Older cards have none. */
  topic?: string;
  /** Plausible wrong answers, for quiz mode. */
  wrong: string[];
  sourceId: string | null;
};

/** Where a card is in spaced repetition: its Leitner box and when it's next due. */
export type CardProgress = { box: number; due: string };

export type Action = {
  id: string;
  /** Where it was made from: an answer, a document or a subject. */
  messageId: string | null;
  documentId: string | null;
  spaceId: string | null;
  createdAt: string;
} & (
  | {
      kind: "checklist";
      payload: { title: string; items: ChecklistItem[] };
      /** Indexes of ticked items. */
      state: { done?: number[] };
    }
  | {
      kind: "flashcards";
      /** `sources` holds the passages the cards cite, so a deck works on its own. */
      payload: { title: string; cards: Flashcard[]; sources?: Source[] };
      /** Progress by card index; cards not in here are new. */
      state: { cards?: Record<string, CardProgress> };
    }
);

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
  studyMethod: StudyMethod;
};

/** How answers teach: quiz you, have you explain it, guide you with questions, or just answer. */
export type StudyMethod = "recall" | "feynman" | "socratic" | "answer";

/** The timer your buddy runs with you. */
export type FocusMethod = "pomodoro" | "52-17" | "flow";

export type AttemptResult = "right" | "almost" | "wrong";
export type StudyMode = "cards" | "quiz" | "recall";

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

export type FlashcardsAction = Extract<Action, { kind: "flashcards" }>;

/** A flashcard deck, with where it came from. */
export type Deck = FlashcardsAction & {
  origin: { kind: "chat" | "document" | "subject"; label: string; href: string | null };
};

/** A concept the student keeps missing, and the cards that test it. */
export type WeakTopic = {
  topic: string;
  /** 0 to 1, from recent attempts: right counts 1, almost a half. */
  score: number;
  attempts: number;
  cards: { deckId: string; index: number }[];
};

export type StudyOverview = {
  decks: Deck[];
  weakTopics: WeakTopic[];
  week: { reviewed: number; accuracy: number | null; focusMinutes: number; sessions: number };
  /** When you studied recently, by the hour, for working out your streak in your own time zone. */
  activity: string[];
};

/** How a typed answer was marked. */
export type CheckResult = { deckId: string; index: number; result: AttemptResult; feedback: string };
