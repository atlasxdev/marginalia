"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, PlusIcon } from "lucide-react";
import { activeExams, decksIn, examDateLabel, examHref, examScope, examSubjects, useDayPlan, useExams, type Exam } from "@/lib/exams";
import { petQuery, spacesQuery, studyQuery } from "@/lib/queries";
import { cardCounts } from "@/lib/subjects";
import type { Space, StudyOverview } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { ExamDialog, ExamOutcome } from "./exam-countdown";

const groupClass = "glass rounded-xl border border-glass-border bg-glass";

/* Exams: what's coming, soonest first, each with how today's plan is going;
   the ones waiting to hear how they went; and the ones that are done. */
export function ExamsView() {
  const hydrated = useHydrated();
  const study = useQuery(studyQuery);
  const spaces = useQuery(spacesQuery);
  const exams = useExams();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const buddy = useQuery(petQuery).data?.name ?? "Your buddy";
  const ready = hydrated && study.data && spaces.data;

  const active = activeExams(exams);
  const waiting = active.filter((e) => e.days < 0);
  const upcoming = active.filter((e) => e.days >= 0);
  const past = exams.filter((e) => e.outcome).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 pt-14 pb-24 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Exams</h1>
            <p className="mt-1.5 text-muted-foreground">{buddy} plans each day up to each one.</p>
          </div>
          {exams.length > 0 && (
            <Button onClick={() => setAdding(true)}>
              <PlusIcon />
              Add exam
            </Button>
          )}
        </div>

        {!ready ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="Loading exams">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        ) : exams.length === 0 ? (
          <Empty className={cn(groupClass, "mt-10 rounded-2xl")}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarIcon />
              </EmptyMedia>
              <EmptyTitle>No exams yet</EmptyTitle>
              <EmptyDescription>Add one, with the subjects it covers, and {buddy} plans what to study each day until it.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setAdding(true)}>
                <PlusIcon />
                Add exam
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            {waiting.map(({ exam, days }) => (
              <ExamOutcome key={exam.id} exam={exam} days={days} className="mt-8" />
            ))}

            {upcoming.length > 0 && (
              <section aria-labelledby="coming-up" className="mt-10">
                <h2 id="coming-up" className="text-xl font-semibold">
                  Coming up
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {upcoming.map(({ exam, days }) => (
                    <ExamTile key={exam.id} exam={exam} days={days} overview={study.data!} spaces={spaces.data!} />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section aria-labelledby="past-exams" className="mt-12">
                <h2 id="past-exams" className="text-xl font-semibold">
                  Past
                </h2>
                <ItemGroup className={`${groupClass} mt-4 gap-0`}>
                  {past.map((exam, i) => (
                    <Fragment key={exam.id}>
                      {i > 0 && <ItemSeparator className="my-0 bg-glass-divider" />}
                      <Item asChild className="rounded-none px-5 py-4 first:rounded-t-xl last:rounded-b-xl hover:bg-glass-strong">
                        <Link href={examHref(exam)}>
                          <ItemContent>
                            <ItemTitle className="text-[15px]">{exam.name}</ItemTitle>
                            <ItemDescription>{examDateLabel(exam.date)}</ItemDescription>
                          </ItemContent>
                          <span className={cn("shrink-0 text-sm", exam.outcome === "good" ? "text-success" : "text-muted-foreground")}>
                            {exam.outcome === "good" ? "Went well" : "Not great"}
                          </span>
                        </Link>
                      </Item>
                    </Fragment>
                  ))}
                </ItemGroup>
              </section>
            )}
          </>
        )}
      </div>
      <ExamDialog open={adding} onOpenChange={setAdding} onSaved={(exam) => router.push(examHref(exam))} />
    </div>
  );
}

/** An exam as a card: how far off it is, what it covers, and how today's plan is going. */
function ExamTile({ exam, days, overview, spaces }: { exam: Exam; days: number; overview: StudyOverview; spaces: Space[] }) {
  const covered = examSubjects(exam, spaces);
  const decks = decksIn(overview.decks, covered);
  const plan = useDayPlan({ key: exam.id, date: exam.date, scope: examScope(exam), decks, weakTopics: overview.weakTopics });
  const cards = decks.reduce((n, d) => n + d.payload.cards.length, 0);
  const counts = cardCounts(decks);
  const learned = Math.max(0, cards - counts.review - counts.fresh);
  const left = plan.tasks.filter((t) => !t.done).length;
  const status =
    cards === 0
      ? "No flashcards yet"
      : plan.stage === "day"
        ? "Exam day. Good luck!"
        : left
          ? `${left} ${left === 1 ? "thing" : "things"} to do today`
          : "Done for today";

  return (
    <div className={`${groupClass} group/card relative flex min-h-44 flex-col rounded-2xl p-5 transition-colors duration-150 hover:bg-glass-strong`}>
      <Link href={examHref(exam)} className="absolute inset-0 rounded-2xl" aria-label={`Open ${exam.name}`} />
      <div className="flex items-baseline gap-3">
        <p className="min-w-0 flex-1 truncate text-lg font-semibold">{exam.name}</p>
        <span className={cn("shrink-0 text-sm font-medium tabular-nums", days <= 7 ? "text-primary" : "text-muted-foreground")}>
          {days === 0 ? "Today" : `${days} ${days === 1 ? "day" : "days"}`}
        </span>
      </div>
      <p className="mt-0.5 truncate text-sm text-muted-foreground">
        {examDateLabel(exam.date)}
        {covered.length > 0 && ` · ${covered.map((s) => s.name).join(", ")}`}
      </p>
      {cards > 0 && (
        <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-label={`${learned} of ${cards} learned`}>
          <div className="bg-success" style={{ width: `${(learned / cards) * 100}%` }} />
          <div className="bg-primary" style={{ width: `${(counts.review / cards) * 100}%` }} />
        </div>
      )}
      <p className={cn("mt-auto pt-4 text-sm", !left && cards > 0 && plan.stage !== "day" && "text-success")}>{status}</p>
    </div>
  );
}
