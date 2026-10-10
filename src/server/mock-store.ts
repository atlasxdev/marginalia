import "server-only";
import type { Conversation, DocumentItem, Message, Source } from "@/lib/types";

// In-memory stand-in for Supabase. Every function here maps to a future table query,
// so the backend phase swaps these bodies without touching the UI.

type StoredDocument = Omit<DocumentItem, "status"> & {
  failReason: string | null;
  ingestStartedAt: number;
};

type Store = {
  documents: StoredDocument[];
  conversations: Conversation[];
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const id = () => crypto.randomUUID();

const HANDBOOK = "handbook";
const REFUNDS = "refunds";
const ONBOARDING = "onboarding";
const MINUTES = "minutes";

const SOURCES: Record<string, Source> = {
  refundWindow: {
    chunkId: "c-1",
    documentId: REFUNDS,
    documentTitle: "Refund policy",
    headingPath: "Eligibility › Time limits",
    excerpt:
      "Customers may request a full refund within 30 days of purchase, provided the item is unused and in its original packaging.",
  },
  refundDigital: {
    chunkId: "c-2",
    documentId: REFUNDS,
    documentTitle: "Refund policy",
    headingPath: "Exceptions › Digital products",
    excerpt:
      "Digital products are refundable within 14 days only if the download link has not been used. Gift cards are non-refundable.",
  },
  leaveAnnual: {
    chunkId: "c-3",
    documentId: HANDBOOK,
    documentTitle: "Employee handbook",
    headingPath: "Time off › Annual leave",
    excerpt:
      "Full-time employees accrue 15 days of paid annual leave per year, credited monthly. Up to 5 unused days carry over to the next year.",
  },
  leaveRequest: {
    chunkId: "c-4",
    documentId: HANDBOOK,
    documentTitle: "Employee handbook",
    headingPath: "Time off › Requesting leave",
    excerpt:
      "Submit leave requests in the HR portal at least 10 working days in advance. Your manager approves or declines within 3 working days.",
  },
  laptop: {
    chunkId: "c-5",
    documentId: ONBOARDING,
    documentTitle: "Onboarding checklist",
    headingPath: "Week 1 › Equipment",
    excerpt:
      "IT issues your laptop on day one. Enable disk encryption and set up two-factor authentication before connecting to the company network.",
  },
};

function seed(): Store {
  return {
    documents: [
      {
        id: HANDBOOK,
        filename: "Employee handbook.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1_842_000,
        error: null,
        chunkCount: 84,
        createdAt: minutesAgo(60 * 24 * 6),
        failReason: null,
        ingestStartedAt: 0,
      },
      {
        id: REFUNDS,
        filename: "Refund policy.md",
        mimeType: "text/markdown",
        sizeBytes: 12_400,
        error: null,
        chunkCount: 9,
        createdAt: minutesAgo(60 * 24 * 2),
        failReason: null,
        ingestStartedAt: 0,
      },
      {
        id: ONBOARDING,
        filename: "Onboarding checklist.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 48_900,
        error: null,
        chunkCount: 17,
        createdAt: minutesAgo(60 * 5),
        failReason: null,
        ingestStartedAt: 0,
      },
      {
        id: MINUTES,
        filename: "Board minutes (scan).pdf",
        mimeType: "application/pdf",
        sizeBytes: 6_310_000,
        error: null,
        chunkCount: 0,
        createdAt: minutesAgo(40),
        failReason:
          "No text found. This looks like a scanned PDF. Export it with selectable text and upload again.",
        ingestStartedAt: 0,
      },
    ],
    conversations: [
      {
        id: "refunds-chat",
        title: "Refunds for digital items",
        updatedAt: minutesAgo(30),
        messages: [
          {
            id: id(),
            role: "user",
            content: "What's the refund window?",
            sources: [],
            createdAt: minutesAgo(32),
          },
          {
            id: id(),
            role: "assistant",
            content:
              "You can request a **full refund within 30 days** of purchase, as long as the item is unused and in its original packaging [1].\n\nDigital products are stricter: **14 days**, and only if the download link hasn't been used [2]. Gift cards can't be refunded at all [2].",
            sources: [SOURCES.refundWindow, SOURCES.refundDigital],
            createdAt: minutesAgo(31),
          },
        ],
      },
      {
        id: "leave-chat",
        title: "How much annual leave do I get?",
        updatedAt: minutesAgo(60 * 26),
        messages: [
          {
            id: id(),
            role: "user",
            content: "How much annual leave do I get, and how do I request it?",
            sources: [],
            createdAt: minutesAgo(60 * 26 + 2),
          },
          {
            id: id(),
            role: "assistant",
            content:
              "| | |\n|---|---|\n| Annual leave | 15 paid days per year, credited monthly [1] |\n| Carry-over | Up to 5 unused days [1] |\n| Notice | Request at least 10 working days ahead [2] |\n| Approval | Your manager replies within 3 working days [2] |\n\nRequests go through the HR portal [2].",
            sources: [SOURCES.leaveAnnual, SOURCES.leaveRequest],
            createdAt: minutesAgo(60 * 26),
          },
        ],
      },
    ],
  };
}

const globalStore = globalThis as unknown as { __ragMockStore?: Store };
const store = (globalStore.__ragMockStore ??= seed());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Documents ----------

// Simulates the ingestion worker: pending → processing → ready/failed over a few seconds.
function statusOf(d: StoredDocument): DocumentItem["status"] {
  if (!d.ingestStartedAt) return d.failReason ? "failed" : "ready";
  const elapsed = Date.now() - d.ingestStartedAt;
  if (elapsed < 2500) return "pending";
  if (elapsed < 7000) return "processing";
  return d.failReason ? "failed" : "ready";
}

function toItem(d: StoredDocument): DocumentItem {
  const status = statusOf(d);
  const { failReason, ingestStartedAt, ...rest } = d;
  void ingestStartedAt;
  return {
    ...rest,
    status,
    error: status === "failed" ? failReason : null,
    chunkCount: status === "ready" ? d.chunkCount : 0,
  };
}

export async function listDocuments(): Promise<DocumentItem[]> {
  await sleep(250);
  return [...store.documents]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toItem);
}

export async function createDocument(file: { name: string; type: string; size: number }) {
  await sleep(400);
  const doc: StoredDocument = {
    id: id(),
    filename: file.name,
    mimeType: file.type || "text/markdown",
    sizeBytes: file.size,
    error: null,
    chunkCount: Math.max(1, Math.round(file.size / 2400)),
    createdAt: new Date().toISOString(),
    // Mock: files with "scan" in the name fail like a scanned PDF would.
    failReason: /scan/i.test(file.name)
      ? "No text found. This looks like a scanned PDF. Export it with selectable text and upload again."
      : null,
    ingestStartedAt: Date.now(),
  };
  store.documents.push(doc);
  return toItem(doc);
}

export async function retryDocument(docId: string) {
  await sleep(300);
  const doc = store.documents.find((d) => d.id === docId);
  if (!doc) return null;
  doc.failReason = null;
  doc.chunkCount ||= Math.max(1, Math.round(doc.sizeBytes / 2400));
  doc.ingestStartedAt = Date.now();
  return toItem(doc);
}

export async function deleteDocument(docId: string) {
  await sleep(300);
  store.documents = store.documents.filter((d) => d.id !== docId);
}

// ---------- Conversations ----------

export async function listConversations() {
  await sleep(200);
  return [...store.conversations]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
}

export async function getConversation(convId: string) {
  await sleep(200);
  return store.conversations.find((c) => c.id === convId) ?? null;
}

export async function createConversation(question: string) {
  await sleep(250);
  const conv: Conversation = {
    id: id(),
    title: question.length > 60 ? question.slice(0, 57) + "…" : question,
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  store.conversations.push(conv);
  await addUserMessage(conv.id, question);
  return conv;
}

export async function addUserMessage(convId: string, content: string) {
  const conv = store.conversations.find((c) => c.id === convId);
  if (!conv) return null;
  const message: Message = {
    id: id(),
    role: "user",
    content,
    sources: [],
    createdAt: new Date().toISOString(),
  };
  conv.messages.push(message);
  conv.updatedAt = message.createdAt;
  return message;
}

export async function addAssistantMessage(convId: string, content: string, sources: Source[]) {
  const conv = store.conversations.find((c) => c.id === convId);
  if (!conv) return null;
  const message: Message = {
    id: id(),
    role: "assistant",
    content,
    sources,
    createdAt: new Date().toISOString(),
  };
  conv.messages.push(message);
  conv.updatedAt = message.createdAt;
  return message;
}

export async function deleteConversation(convId: string) {
  await sleep(200);
  store.conversations = store.conversations.filter((c) => c.id !== convId);
}

// ---------- Mock retrieval + generation ----------

type MockAnswer = { text: string; sources: Source[] };

const NOT_FOUND = "I couldn't find that in your documents.";

// Stand-in for: embed question → hybrid search → threshold → Gemini.
export function mockAnswer(question: string): MockAnswer | "quota" {
  const q = question.toLowerCase();
  if (q.includes("quota")) return "quota";
  if (q.includes("refund") || q.includes("return")) {
    return {
      text: "Standard purchases can be refunded **within 30 days**, if the item is unused and still in its original packaging [1].\n\nDigital products have a shorter window of **14 days**, and only when the download link hasn't been used. Gift cards are never refundable [2].",
      sources: [SOURCES.refundWindow, SOURCES.refundDigital],
    };
  }
  if (q.includes("leave") || q.includes("vacation") || q.includes("time off")) {
    return {
      text: "Full-time employees get **15 paid days** of annual leave a year, credited monthly, and up to 5 unused days carry over [1].\n\nTo take leave:\n\n1. Open the HR portal.\n2. Submit the request at least 10 working days ahead.\n3. Your manager approves or declines within 3 working days [2].",
      sources: [SOURCES.leaveAnnual, SOURCES.leaveRequest],
    };
  }
  if (q.includes("laptop") || q.includes("onboarding") || q.includes("first day")) {
    return {
      text: "IT hands you a laptop on your first day. Before connecting to the company network, turn on disk encryption and set up two-factor authentication [1].",
      sources: [SOURCES.laptop],
    };
  }
  // Below the similarity threshold: no LLM call, no sources.
  return { text: NOT_FOUND, sources: [] };
}
