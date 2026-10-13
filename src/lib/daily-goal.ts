"use client";

import { useQuery } from "@tanstack/react-query";
import { meQuery, studyQuery } from "./queries";

export const DAILY_GOALS = [0, 10, 20, 30, 50] as const;
export const DEFAULT_DAILY_GOAL = 20;

/* Your daily goal: cards answered today, in your own time zone, against the
   number you aim for. A goal of 0 means it's off. */
export function useDailyGoal() {
  const me = useQuery(meQuery).data;
  const overview = useQuery(studyQuery).data;
  const saved = me?.user_metadata?.daily_goal;
  const goal: number = typeof saved === "number" ? saved : DEFAULT_DAILY_GOAL;
  const today = new Date().toDateString();
  const done = overview?.recentAttempts.filter((t) => new Date(t).toDateString() === today).length ?? 0;
  return { goal, done, reached: goal > 0 && done >= goal, progress: goal > 0 ? Math.min(1, done / goal) : 0 };
}
