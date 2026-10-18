"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, PlusIcon } from "lucide-react";
import { activeExams, eventDateLabel, examHref, useExams } from "@/lib/exams";
import { petQuery, spacesQuery, studyQuery } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { EventCard, ExamDialog, ExamOutcome } from "./exam-countdown";

const groupClass = "glass rounded-xl border border-glass-border bg-glass";

/* Events: what's coming, soonest first, as cards like your subjects on Today, each
   with how ready you are and the next thing to do; then the ones that are done. */
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
      <div className="mx-auto max-w-6xl px-5 pt-14 pb-24 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Events</h1>
            <p className="mt-1.5 text-muted-foreground">Tests, deadlines, anything with a date. {buddy} plans the days before the ones with subjects.</p>
          </div>
          {exams.length > 0 && (
            <Button onClick={() => setAdding(true)}>
              <PlusIcon />
              Add event
            </Button>
          )}
        </div>

        {!ready ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading events">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        ) : exams.length === 0 ? (
          <Empty className={cn(groupClass, "mt-10 rounded-2xl")}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarIcon />
              </EmptyMedia>
              <EmptyTitle>Nothing coming up</EmptyTitle>
              <EmptyDescription>Add a test, a deadline or anything with a date. Link its subjects and {buddy} plans what to study each day until it.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setAdding(true)}>
                <PlusIcon />
                Add event
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            {waiting.map(({ exam }) => (
              <ExamOutcome key={exam.id} exam={exam} className="mt-8" />
            ))}

            {upcoming.length > 0 && (
              <section aria-labelledby="coming-up" className="mt-12">
                <h2 id="coming-up" className="text-xl font-semibold">
                  Coming up
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map(({ exam, days }) => (
                    <EventCard key={exam.id} exam={exam} days={days} overview={study.data!} spaces={spaces.data!} />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section aria-labelledby="past-events" className="mt-12">
                <h2 id="past-events" className="text-xl font-semibold">
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
                            <ItemDescription>{eventDateLabel(exam)}</ItemDescription>
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
