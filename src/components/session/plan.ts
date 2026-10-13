import type { StudyItem } from "@/lib/use-study";
import type { StudyMode } from "@/lib/types";

/** How a step is asked: a card mode, or a follow-up to a miss (explain it back, or practice using it). */
export type StepMode = StudyMode | "teach" | "practice";

/** One thing to do in a session: a card, and how it's asked. */
export type Step = {
  key: string;
  item: StudyItem;
  mode: StepMode;
  /** Why it's in the plan: due for review, a weak topic, new, missed earlier, or a follow-up to a miss. */
  reason: "due" | "weak" | "new" | "again" | "followup";
  /** For practice: the answer that missed, so the questions target that mistake. */
  context?: string;
};

const WEAK_LIMIT = 5;
const NEW_LIMIT = 10;
const PLAN_LIMIT = 40;

export const itemKey = (item: StudyItem) => `${item.deckId}:${item.index}`;

const step = (item: StudyItem, mode: StudyMode, reason: Step["reason"]): Step => ({ key: itemKey(item), item, mode, reason });

/* The session plan, the way a tutor would run it:
   1. Reviews that are due, as flip cards (quick, and the schedule says it's time).
   2. Weak topics, typed out in your own words and checked against your notes.
   3. New cards, as multiple choice when there are choices, so they're met before they're tested.
   With nothing due, weak or new, it practises the cards you know least. */
export function buildPlan(items: StudyItem[], weakKeys: Set<string>, now = new Date()): Step[] {
  const seen = new Set<string>();
  const take = (list: Step[]) => list.filter((s) => !seen.has(s.key) && seen.add(s.key));

  const due = take(items.filter((i) => i.progress && new Date(i.progress.due) <= now).map((i) => step(i, "cards", "due")));
  const weak = take(items.filter((i) => weakKeys.has(itemKey(i))).map((i) => step(i, "recall", "weak"))).slice(0, WEAK_LIMIT);
  const fresh = take(
    items.filter((i) => !i.progress).map((i) => step(i, i.card.wrong.length >= 2 ? "quiz" : "cards", "new"))
  ).slice(0, NEW_LIMIT);

  const plan = [...due, ...weak, ...fresh];
  if (plan.length > 0) return plan.slice(0, PLAN_LIMIT);

  return [...items]
    .sort((a, b) => (a.progress?.box ?? 0) - (b.progress?.box ?? 0))
    .slice(0, NEW_LIMIT)
    .map((i) => step(i, "cards", "due"));
}

/** A weak-topic session: type the first few, then flip the rest. */
export function topicPlan(items: StudyItem[]): Step[] {
  return items.slice(0, PLAN_LIMIT).map((i, n) => step(i, n < WEAK_LIMIT ? "recall" : "cards", "weak"));
}
