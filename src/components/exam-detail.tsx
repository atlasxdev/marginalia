"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarIcon, ChevronLeftIcon, LinkIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { decksIn, eventDateLabel, eventDays, examSubjects, onNow, useExams, type Exam } from "@/lib/exams";
import { documentsQuery, meQuery, petQuery, spacesQuery, studyQuery } from "@/lib/queries";
import { subjectDecks, topicsIn } from "@/lib/subjects";
import type { DocumentItem, Space, StudyOverview } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ExamCountdown, ExamDialog, ExamOutcome, useDeleteExam } from "./exam-countdown";
import { SubjectCard, WeakTopicList } from "./study-hub";

const groupClass = "glass rounded-xl border border-glass-border bg-glass";

export function ExamDetailView({ id }: { id: string }) {
  const hydrated = useHydrated();
  const me = useQuery(meQuery);
  const study = useQuery(studyQuery);
  const spaces = useQuery(spacesQuery);
  const documents = useQuery(documentsQuery);
  const exam = useExams().find((e) => e.id === id);
  const ready = hydrated && me.isSuccess && study.data && spaces.data && documents.data;

  if (ready && !exam) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarIcon />
          </EmptyMedia>
          <EmptyTitle>This event isn&apos;t available</EmptyTitle>
          <EmptyDescription>It may have been deleted.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/events">Back to Events</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-5 pt-10 pb-24 sm:px-8 lg:px-12">
        {ready && exam ? (
          <ExamDetail key={exam.id} exam={exam} overview={study.data!} spaces={spaces.data!} documents={documents.data!} />
        ) : (
          <div className="space-y-4 pt-4" aria-label="Loading event">
            <Skeleton className="h-9 w-1/2" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        )}
      </div>
    </div>
  );
}

function ExamDetail({ exam, overview, spaces, documents }: { exam: Exam; overview: StudyOverview; spaces: Space[]; documents: DocumentItem[] }) {
  const router = useRouter();
  const remove = useDeleteExam();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const days = eventDays(exam);
  const covered = examSubjects(exam, spaces);
  const decks = decksIn(overview.decks, covered);
  const weak = topicsIn(overview.weakTopics, decks);
  const buddy = useQuery(petQuery).data?.name ?? "your buddy";

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2.5 text-muted-foreground">
        <Link href="/events">
          <ChevronLeftIcon />
          Events
        </Link>
      </Button>

      <div className="mt-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-bold tracking-tight wrap-anywhere">{exam.name}</h1>
          <p className="mt-1.5 text-muted-foreground">
            {eventDateLabel(exam)}
            {covered.length > 0 && ` · ${covered.map((s) => s.name).join(", ")}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Edit event" onClick={() => setEditing(true)} className="text-muted-foreground">
          <PencilIcon />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More options for this event" className="text-muted-foreground">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-48">
            <DropdownMenuItem variant="destructive" className="gap-2.5 px-2.5 py-2" onSelect={() => setConfirming(true)}>
              <Trash2Icon />
              Delete event
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {exam.outcome ? (
        <section className={`${groupClass} mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl p-6`}>
          <p className="min-w-56 flex-1 text-lg">
            {exam.outcome === "good" ? "You said it went well. Nice work." : "You said it didn't go great. Your notes and cards are still here."}
          </p>
          <Button variant="glass" onClick={() => setEditing(true)}>
            Set a new date
          </Button>
        </section>
      ) : days < 0 ? (
        <ExamOutcome exam={exam} className="mt-8" />
      ) : covered.length ? (
        <ExamCountdown exam={exam} days={days} overview={overview} spaces={spaces} className="mt-8" />
      ) : (
        // No subjects: the countdown, and an offer of a plan
        <section aria-labelledby="exam-countdown" className={`${groupClass} mt-8 rounded-2xl p-6 sm:p-8`}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <h2 id="exam-countdown" className="shrink-0 sm:w-44">
              {days === 0 ? (
                <span className="block text-4xl font-bold tracking-tight">{onNow(exam) ? "On now" : "Today"}</span>
              ) : (
                <>
                  <span className="block text-5xl font-bold tracking-tight tabular-nums">{days}</span>
                  <span className="mt-1 block text-muted-foreground">{days === 1 ? "day to go" : "days to go"}</span>
                </>
              )}
            </h2>
            <div className="min-w-0 flex-1 border-glass-divider max-sm:border-t max-sm:pt-5 sm:border-l sm:pl-8">
              <p className="text-lg font-semibold">Want a plan for this?</p>
              <p className="mt-1 text-muted-foreground text-pretty">
                Link the subjects it covers and {buddy} spreads your flashcards over the days left, with practice exams near the end.
              </p>
              <Button className="mt-4" onClick={() => setEditing(true)}>
                <LinkIcon />
                Link subjects
              </Button>
            </div>
          </div>
        </section>
      )}

      {covered.length > 0 && (
        <section aria-labelledby="exam-subjects" className="mt-12">
          <div className="flex items-center justify-between gap-3">
            <h2 id="exam-subjects" className="text-xl font-semibold">
              Subjects
            </h2>
            <Button variant="glass" size="sm" onClick={() => setEditing(true)}>
              Change
            </Button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {covered.map((s) => (
              <SubjectCard key={s.id} space={s} overview={overview} documents={documents} />
            ))}
          </div>
        </section>
      )}

      {weak.length > 0 && (
        <section aria-labelledby="exam-weak" className="mt-12">
          <h2 id="exam-weak" className="text-xl font-semibold">
            Needs work
          </h2>
          <WeakTopicList topics={weak.slice(0, 5)} subjectOf={(t) => covered.find((s) => topicsIn([t], subjectDecks(decks, s)).length)} />
        </section>
      )}

      <ExamDialog open={editing} onOpenChange={setEditing} exam={exam} />
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="border border-glass-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{exam.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Its countdown and plan go. Your subjects, notes and flashcards stay as they are.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                remove.mutate(exam.id, {
                  onSuccess: () => {
                    toast.success(`“${exam.name}” deleted`);
                    router.push("/events");
                  },
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
