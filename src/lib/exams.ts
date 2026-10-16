"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { meQuery } from "./queries";
import { cardCounts, deckInSubject, sessionHref, topicsIn, type SessionScope } from "./subjects";
import type { Deck, Space, WeakTopic } from "./types";

/* Exams: a name, a day, and the subjects it covers, kept with your account like
   your daily goal. The countdown doesn't make anything new. It spreads what the
   subjects already have over the days left: new cards first, weak topics as they
   show up, and practice exams in the last few days. It works from where you are
   each day, so a missed day or a bad quiz just reshuffles the rest. */

export type Exam = {
  id: string;
  name: string;
  /** The exam's day, "YYYY-MM-DD", in your own time zone. */
  date: string;
  spaceIds: string[];
  /** Set once you've said how it went; the countdown is over then. */
  outcome?: "good" | "rough";
};

/** Where the last practice exam score is kept in this browser, for a subject or an exam. */
export const lastExamKey = (id: string) => `marginalia:exam:${id}`;

/** The last few days before the exam are for practice exams. */
const FINAL_DAYS = 3;

/* Saved exams, read from the account. The first version kept one exam per
   subject, keyed by the subject; those read as exams covering that one subject. */
export function readExams(saved: unknown): Exam[] {
  if (Array.isArray(saved)) return saved.filter((e): e is Exam => !!e && typeof e.id === "string" && typeof e.date === "string" && Array.isArray(e.spaceIds));
  if (saved && typeof saved === "object")
    return Object.entries(saved as Record<string, Omit<Exam, "id" | "spaceIds">>).map(([spaceId, e]) => ({ ...e, id: spaceId, spaceIds: [spaceId] }));
  return [];
}

/** Your exams. */
export function useExams(): Exam[] {
  return readExams(useQuery(meQuery).data?.user_metadata?.exams);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function fromDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Days from today to the exam: 0 on the day, negative once it's past. */
export const daysUntil = (date: string, now = new Date()) =>
  Math.round((fromDateKey(date).getTime() - startOfDay(now).getTime()) / 86_400_000);

/** "in 12 days", "tomorrow", "today", or "3 days ago". */
export function whenLine(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1) return `in ${days} days`;
  return days === -1 ? "yesterday" : `${-days} days ago`;
}

export const examDateLabel = (date: string) =>
  fromDateKey(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export const examHref = (exam: Exam) => `/exams/${exam.id}`;

/** The subjects an exam covers that still exist. */
export const examSubjects = (exam: Exam, spaces: Space[]) => spaces.filter((s) => exam.spaceIds.includes(s.id));

/** Decks in any of these subjects. */
export const decksIn = (decks: Deck[], spaces: Space[]) => decks.filter((d) => spaces.some((s) => deckInSubject(d, s)));

/** Where an exam's sessions and practice exams draw from: its subject, or the exam itself when it covers several. */
export const examScope = (exam: Exam): SessionScope => (exam.spaceIds.length === 1 ? { subject: exam.spaceIds[0] } : { exam: exam.id });
export const practiceHref = (scope: SessionScope) => `/exam?${scope.exam ? `exam=${scope.exam}` : `subject=${scope.subject}`}`;

/** Exams still to come (or just past and waiting to hear how they went), soonest first. */
export function activeExams(exams: Exam[], now = new Date()) {
  return exams
    .filter((e) => !e.outcome)
    .map((exam) => ({ exam, days: daysUntil(exam.date, now) }))
    .sort((a, b) => a.days - b.days);
}

/** The soonest exam still to come that covers a subject. */
export const nextExamFor = (exams: Exam[], spaceId: string) =>
  activeExams(exams).find((e) => e.days >= 0 && e.exam.spaceIds.includes(spaceId));

/* ---------- today's plan ---------- */

export type PlanTask = {
  key: "review" | "new" | "weak" | "exam";
  label: string;
  /** "4 of 12", for tasks counted in cards. */
  progress?: string;
  done: boolean;
  href: string;
};

export type DayPlan = {
  days: number;
  stage: "learn" | "final" | "day" | "over";
  tasks: PlanTask[];
  /** The first thing not done yet, or null when today's plan is finished. */
  next: PlanTask | null;
};

type Counts = { review: number; fresh: number };

/* New and due cards as they were this morning, kept in this browser, so today's
   share stays put as you work through it. New notes during the day add to it. */
function useMorning(key: string, now: Counts): Counts {
  const storageKey = `marginalia:plan:${key}`;
  const today = toDateKey(new Date());
  const [start, setStart] = useState<Counts>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved?.day === today && typeof saved.fresh === "number" && typeof saved.review === "number")
        return { review: saved.review, fresh: saved.fresh };
    } catch {
      // A convenience only; without it today's share counts from now
    }
    return now;
  });
  const review = Math.max(start.review, now.review);
  const fresh = Math.max(start.fresh, now.fresh);
  // More cards during the day (new notes, a miss coming back) raise today's share
  if (review !== start.review || fresh !== start.fresh) setStart({ review, fresh });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ day: today, review, fresh }));
    } catch {
      // Private windows can refuse storage; the plan still works for this visit
    }
  }, [storageKey, today, review, fresh]);
  return { review, fresh };
}

/** Whether a practice exam was finished today, in this browser. */
function examTakenToday(id: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(lastExamKey(id)) ?? "null");
    return !!saved?.at && new Date(saved.at).toDateString() === new Date().toDateString();
  } catch {
    return false;
  }
}

/** Today's plan toward an exam, over the given decks: the exam's, or one subject's share of it. */
export function useDayPlan({ key, date, scope, decks, weakTopics }: { key: string; date: string; scope: SessionScope; decks: Deck[]; weakTopics: WeakTopic[] }): DayPlan {
  const { review, fresh } = cardCounts(decks);
  const morning = useMorning(key, { review, fresh });
  const days = daysUntil(date);
  const weak = topicsIn(weakTopics, decks)[0];
  const cards = decks.reduce((n, d) => n + d.payload.cards.length, 0);
  const study = sessionHref(scope);

  if (days < 0) return { days, stage: "over", tasks: [], next: null };

  // Reviews: what was due this morning, ticked off as they're answered right
  const reviewed = morning.review - review;
  const reviewTask = (label: string): PlanTask => ({
    key: "review",
    label,
    progress: reviewed > 0 && review > 0 ? `${reviewed} of ${morning.review}` : undefined,
    done: review === 0,
    href: study,
  });
  const plural = (n: number) => `${n} ${n === 1 ? "card" : "cards"}`;

  // On the day: only what's due, then rest
  if (days === 0) {
    const tasks = morning.review ? [reviewTask(`Light review of ${plural(morning.review)}`)] : [];
    return { days, stage: "day", tasks, next: tasks.find((t) => !t.done) ?? null };
  }

  const final = days <= FINAL_DAYS;
  // Spread the new cards over the days before the final stretch (or what's left of it)
  const learnDays = final ? days : days - FINAL_DAYS;
  const target = Math.min(morning.fresh, Math.ceil(morning.fresh / Math.max(1, learnDays)));
  const learned = Math.min(target, morning.fresh - fresh);

  const tasks: PlanTask[] = [];
  if (morning.review) tasks.push(reviewTask(`Review ${plural(morning.review)}`));
  if (target > 0)
    tasks.push({
      key: "new",
      label: `Learn ${target} new ${target === 1 ? "card" : "cards"}`,
      progress: learned > 0 && learned < target ? `${learned} of ${target}` : undefined,
      done: learned >= target,
      href: study,
    });
  if (weak) tasks.push({ key: "weak", label: `Practice ${weak.topic}`, done: false, href: sessionHref({ ...scope, topic: weak.topic }) });
  // Practice exams in the final stretch, or sooner once every card has been met
  if (cards >= 3 && (final || fresh === 0))
    tasks.push({ key: "exam", label: "Take a practice exam", done: examTakenToday(scope.exam ?? scope.subject ?? ""), href: practiceHref(scope) });

  return { days, stage: final ? "final" : "learn", tasks, next: tasks.find((t) => !t.done) ?? null };
}
