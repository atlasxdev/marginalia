import type { StudyOverview } from "./types";

/*
 * Your buddy has no needs of its own: how it's doing is how your studying is
 * doing. Its mood, greeting and stats all come from your study overview.
 */

/** Days in a row you've studied, counting today or, if you haven't yet, yesterday. */
export function streakFrom(activity: string[], now = new Date()) {
  const day = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days = new Set(activity.map((t) => day(new Date(t))));
  const cursor = new Date(now);
  if (!days.has(day(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(day(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function petLevel(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 12)) + 1;
  const nextAt = 12 * level * level;
  const prevAt = 12 * (level - 1) * (level - 1);
  return { level, progress: (xp - prevAt) / (nextAt - prevAt) };
}

export type StudyStatus = {
  streak: number;
  due: number;
  studiedToday: boolean;
  /** Whether you've studied at all lately. */
  studiedBefore: boolean;
  /** The last seven days, oldest first: whether you studied on each. */
  weekDays: boolean[];
  week: StudyOverview["week"];
};

export function studyStatus(overview: StudyOverview | undefined, due: number, now = new Date()): StudyStatus {
  const activity = overview?.activity ?? [];
  const today = now.toDateString();
  return {
    streak: streakFrom(activity, now),
    due,
    studiedToday: activity.some((t) => new Date(t).toDateString() === today),
    studiedBefore: activity.length > 0,
    weekDays: Array.from({ length: 7 }, (_, i) => {
      const day = new Date(now);
      day.setDate(day.getDate() - (6 - i));
      return activity.some((t) => new Date(t).toDateString() === day.toDateString());
    }),
    week: overview?.week ?? { reviewed: 0, accuracy: null, focusMinutes: 0, sessions: 0 },
  };
}

// A big backlog worries it more than a quiet day
const BACKLOG = 20;

/** A word for how it feels about your studying. */
export function petMood(s: StudyStatus) {
  if (s.studiedToday) return "Proud";
  if (s.due >= BACKLOG) return "Worried";
  if (s.studiedBefore && s.streak === 0) return "Misses you";
  return "Ready";
}

/** What it says when you pick up the handheld: the next thing to do. */
export function petGreeting(name: string, s: StudyStatus) {
  if (s.due > 0) return `${s.due} ${s.due === 1 ? "card" : "cards"} due. Study?`;
  if (s.studiedToday) return "Nice work today!";
  if (s.streak > 0) return `Keep your ${s.streak}-day streak?`;
  return `Hi! I'm ${name}. Study?`;
}
