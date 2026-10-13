import type { StudyMethod } from "./types";

/** How your buddy teaches in chat. Shown in pickers; the prompts live in rag.ts. */
export const STUDY_METHODS: Record<StudyMethod, { name: string; detail: string }> = {
  recall: { name: "Active recall", detail: "Answers, then asks you a quick question to make it stick." },
  feynman: { name: "Feynman", detail: "Explains it simply, then has you explain it back and checks you." },
  socratic: { name: "Socratic", detail: "Guides you to the answer with questions instead of telling you." },
  answer: { name: "Just answer", detail: "Straight answers with sources, for quick facts." },
};

export const DEFAULT_STUDY_METHOD: StudyMethod = "recall";

export const isStudyMethod = (value: unknown): value is StudyMethod =>
  typeof value === "string" && value in STUDY_METHODS;
