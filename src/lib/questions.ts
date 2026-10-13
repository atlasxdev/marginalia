import type { Flashcard } from "@/lib/types";

/* Ways to ask a card besides flipping it or typing the answer. True or false
   works on any card with wrong answers; select-all needs a card made with
   several right answers. */

export function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The card's question with an answer that's either the right one or a wrong one. */
export type Claim = { answer: string; isTrue: boolean };

export function makeClaim(card: Flashcard): Claim | null {
  if (!card.wrong.length) return null;
  const isTrue = Math.random() < 0.5;
  return { answer: isTrue ? card.back : card.wrong[Math.floor(Math.random() * card.wrong.length)], isTrue };
}

/** A select-all-that-apply question, its options shuffled. */
export type SelectAll = { question: string; options: string[]; right: string[] };

export function makeSelectAll(card: Flashcard): SelectAll | null {
  const m = card.multi;
  if (!m || m.right.length < 2 || !m.wrong.length) return null;
  return { question: m.question, options: shuffle([...m.right, ...m.wrong]), right: m.right };
}

/** Right only when exactly the right options are picked. */
export const pickedAllRight = (picked: string[], right: string[]) =>
  picked.length === right.length && right.every((r) => picked.includes(r));
