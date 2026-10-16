"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { lastExamKey } from "@/components/exam/exam-view";
import { meQuery } from "./queries";
import { cardCounts, sessionHref, subjectDecks, topicsIn } from "./subjects";
import type { Deck, Space, WeakTopic } from "./types";

/* Exam dates: one per subject, kept with your account like your daily goal.
   The countdown doesn't make anything new. It spreads what the subject already
   has over the days left: new cards first, weak topics as they show up, and
   practice exams in the last few days. It works from where you are each day,
   so a missed day or a bad quiz just reshuffles the rest. */

export type ExamDate = {
  /** The exam's day, "YYYY-MM-DD", in your own time zone. */
  date: string;
  name: string;
  /** Set once you've said how it went; the countdown is over then. */
  outcome?: "good" | "rough";
};
export type Exams = Record<string, ExamDate>;

/** The last few days before the exam are for practice exams. */
const FINAL_DAYS = 3;

/** Your exam dates, by subject. */
export function useExams(): Exams {
  const saved = useQuery(meQuery).data?.user_metadata?.exams;
  return saved && typeof saved === "object" ? (saved as Exams) : {};
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

/** Subjects with an exam still to come (or just past and waiting to hear how it went), soonest first. */
export function activeExams(exams: Exams, spaces: Space[], now = new Date()) {
  return spaces
    .flatMap((space) => {
      const exam = exams[space.id];
      return exam && !exam.outcome ? [{ space, exam, days: daysUntil(exam.date, now) }] : [];
    })
    .sort((a, b) => a.days - b.days);
}

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

/* A subject's new and due cards as they were this morning, kept in this browser,
   so today's share stays put as you work through it. New notes during the day add to it. */
function useMorning(spaceId: string, now: Counts): Counts {
  const key = `marginalia:plan:${spaceId}`;
  const today = toDateKey(new Date());
  const [start, setStart] = useState<Counts>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null");
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
      localStorage.setItem(key, JSON.stringify({ day: today, review, fresh }));
    } catch {
      // Private windows can refuse storage; the plan still works for this visit
    }
  }, [key, today, review, fresh]);
  return { review, fresh };
}

/** Whether a practice exam in this subject was finished today, in this browser. */
function examTakenToday(spaceId: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(lastExamKey(spaceId)) ?? "null");
    return !!saved?.at && new Date(saved.at).toDateString() === new Date().toDateString();
  } catch {
    return false;
  }
}

/** Today's plan for a subject with an exam coming. */
export function useDayPlan(space: Space, exam: ExamDate, decks: Deck[], weakTopics: WeakTopic[]): DayPlan {
  const own = subjectDecks(decks, space);
  const { review, fresh } = cardCounts(own);
  const morning = useMorning(space.id, { review, fresh });
  const days = daysUntil(exam.date);
  const weak = topicsIn(weakTopics, own)[0];
  const cards = own.reduce((n, d) => n + d.payload.cards.length, 0);
  const study = sessionHref({ subject: space.id });
  const examHref = `/exam?subject=${space.id}`;

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
  if (weak) tasks.push({ key: "weak", label: `Practice ${weak.topic}`, done: false, href: sessionHref({ topic: weak.topic, subject: space.id }) });
  // Practice exams in the final stretch, or sooner once every card has been met
  if (cards >= 3 && (final || fresh === 0)) tasks.push({ key: "exam", label: "Take a practice exam", done: examTakenToday(space.id), href: examHref });

  return { days, stage: final ? "final" : "learn", tasks, next: tasks.find((t) => !t.done) ?? null };
}
