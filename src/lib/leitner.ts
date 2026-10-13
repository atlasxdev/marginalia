import type { CardProgress } from "./types";

/* Spaced repetition with Leitner boxes. A card you get right moves up a box
   and waits longer before it's due again; one you miss goes back to box 0. */
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
export const TOP_BOX = INTERVAL_DAYS.length - 1;

export function isDue(progress: CardProgress | undefined, now = new Date()) {
  return !progress || new Date(progress.due) <= now;
}

export function rate(progress: CardProgress | undefined, gotIt: boolean, now = new Date()): CardProgress {
  const box = gotIt ? Math.min((progress?.box ?? 0) + 1, TOP_BOX) : 0;
  const due = new Date(now);
  if (box > 0) {
    // Due at the start of that day, so a card isn't held back by the hour you studied it
    due.setDate(due.getDate() + INTERVAL_DAYS[box]);
    due.setHours(0, 0, 0, 0);
  }
  return { box, due: due.toISOString() };
}
