"use client";

import { useId, useState } from "react";
import type { DateRange } from "react-day-picker";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarIcon, CalendarPlusIcon, CheckIcon, ChevronRightIcon, GraduationCapIcon, LinkIcon, PlayIcon, PlusIcon } from "lucide-react";
import {
  decksIn,
  eventDateLabel,
  eventDays,
  eventWhen,
  examHref,
  examScope,
  examDateLabel,
  examSubjects,
  fromDateKey,
  onNow,
  nextExamFor,
  practiceHref,
  toDateKey,
  useDayPlan,
  useExams,
  type DayPlan,
  type Exam,
} from "@/lib/exams";
import { petQuery, spacesQuery } from "@/lib/queries";
import { cardCounts, sessionHref, subjectDecks } from "@/lib/subjects";
import type { Space, StudyOverview } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteExam, saveExam, type ExamInput } from "@/lib/writes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const groupClass = "glass rounded-xl border border-glass-border bg-glass";

/** Saves and deletes, putting the saved list straight into the signed-in user so every page updates at once. */
function useExamWrites() {
  const queryClient = useQueryClient();
  const put = (exams?: Exam[]) =>
    queryClient.setQueryData(["me"], (me: unknown) =>
      me && typeof me === "object" ? { ...me, user_metadata: { ...(me as { user_metadata?: object }).user_metadata, exams } } : me
    );
  const save = useMutation({
    mutationFn: async (input: ExamInput) => {
      const result = await saveExam(input);
      if (!result.ok) throw new Error(result.message);
      put(result.exams);
      return result.exam!;
    },
    onError: (e) => toast.error(e.message || "Couldn't save the event. Try again."),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteExam(id);
      if (!result.ok) throw new Error(result.message);
      put(result.exams);
    },
    onError: (e) => toast.error(e.message || "Couldn't delete the event. Try again."),
  });
  return { save, remove };
}

export const useDeleteExam = () => useExamWrites().remove;

/* ---------- adding and editing ---------- */

/** Adds an event, or edits one: its name, day and (if you like) the subjects it covers. */
export function ExamDialog({
  exam,
  subjectIds,
  day,
  open,
  onOpenChange,
  onSaved,
}: {
  exam?: Exam;
  /** Subjects ticked to start with, for a new event. */
  subjectIds?: string[];
  /** The day picked to start with, for a new event. */
  day?: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (exam: Exam) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass flex max-h-[90dvh] flex-col gap-0 border border-glass-border bg-glass-strong p-0 sm:max-w-3xl">
        {/* Remounted on each open, so the fields start from the saved event */}
        {open && <ExamForm exam={exam} subjectIds={subjectIds} day={day} onDone={(saved) => (onOpenChange(false), onSaved?.(saved))} />}
      </DialogContent>
    </Dialog>
  );
}

function ExamForm({ exam, subjectIds, day, onDone }: { exam?: Exam; subjectIds?: string[]; day?: Date; onDone: (exam: Exam) => void }) {
  const { save } = useExamWrites();
  const spaces = useQuery(spacesQuery).data ?? [];
  const uid = useId();
  const [name, setName] = useState(exam?.name ?? "");
  const [range, setRange] = useState<DateRange | undefined>(
    exam ? { from: fromDateKey(exam.date), to: exam.end ? fromDateKey(exam.end) : undefined } : day ? { from: day } : undefined
  );
  const date = range?.from;
  const end = range?.to && date && toDateKey(range.to) !== toDateKey(date) ? toDateKey(range.to) : undefined;
  const [picked, setPicked] = useState<Set<string>>(() => new Set(exam?.spaceIds ?? subjectIds ?? []));
  const [today] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (!date) return;
        // Moving the date starts the countdown again, even after it was answered
        save.mutate(
          { id: exam?.id, name, date: toDateKey(date), end, spaceIds: [...picked], outcome: exam && toDateKey(date) === exam.date && end === exam.end ? exam.outcome : undefined },
          { onSuccess: (saved) => (toast.success(`${saved.name} set for ${eventDateLabel(saved)}`), onDone(saved)) }
        );
      }}
    >
      <DialogHeader className="border-b border-glass-divider p-6">
        <DialogTitle>{exam ? "Edit event" : "Add an event"}</DialogTitle>
        <DialogDescription>A test, a deadline, anything with a date. Link its subjects and your buddy plans each day up to it.</DialogDescription>
      </DialogHeader>
      {/* What it is on the left, when on the right; stacked on a phone */}
      <div className="grid min-h-0 flex-1 gap-8 overflow-y-auto p-6 md:grid-cols-[minmax(0,1fr)_auto] md:gap-10 md:p-8">
        <FieldGroup className="content-start">
          <Field>
            <FieldLabel htmlFor={`${uid}-name`}>Name</FieldLabel>
            <Input
              id={`${uid}-name`}
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="For example: Biology midterm"
              className="h-11 rounded-xl bg-popover text-base"
            />
          </Field>
          <FieldSet>
            <FieldLegend variant="label">
              Subjects it covers <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLegend>
            {spaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subjects yet. Without any, this is just a countdown.</p>
            ) : (
              <div className="grid gap-0.5">
                {spaces.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-foreground/5">
                    <Checkbox checked={picked.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground">With subjects, your buddy plans each day up to it. Without, it&apos;s a countdown.</p>
          </FieldSet>
        </FieldGroup>
        <Field className="content-start">
          <FieldLabel>Dates</FieldLabel>
          <p className="-mt-1 text-sm text-muted-foreground">
            {date ? `${examDateLabel(toDateKey(date))}${end ? ` – ${examDateLabel(end)}` : ". Pick a last day too if it runs longer."}` : "Pick a day, or a first and last day."}
          </p>
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            disabled={{ before: today }}
            startMonth={today}
            defaultMonth={date ?? today}
            className="mx-auto rounded-2xl bg-popover/60 p-3 ring-1 ring-foreground/10 [--cell-size:--spacing(10)]"
          />
        </Field>
      </div>
      <DialogFooter className="m-0 flex-row items-center justify-end border-t border-glass-divider bg-transparent px-6 py-5">
        <Button type="submit" disabled={!date || save.isPending}>
          {save.isPending && <Spinner />}
          {exam ? "Save" : "Add event"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** An invitation to add an event, where there isn't one yet. */
export function ExamPrompt({ subjectId, className }: { subjectId?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const buddy = useQuery(petQuery).data?.name ?? "your buddy";
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3", className)}>
      <CalendarPlusIcon className="size-5 shrink-0 text-primary" aria-hidden />
      <p className="min-w-48 flex-1 text-muted-foreground">Have a test or deadline coming? Add the date and {buddy} plans each day up to it.</p>
      <Button variant="glass" onClick={() => setOpen(true)}>
        Add event
      </Button>
      <ExamDialog open={open} onOpenChange={setOpen} subjectIds={subjectId ? [subjectId] : undefined} />
    </div>
  );
}

/** In a subject's header: its next event, or a way to add one. */
export function ExamChip({ space }: { space: Space }) {
  const next = nextExamFor(useExams(), space.id);
  const [open, setOpen] = useState(false);
  if (!next) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="-ml-2.5 text-muted-foreground">
          <CalendarPlusIcon />
          Add an event
        </Button>
        <ExamDialog open={open} onOpenChange={setOpen} subjectIds={[space.id]} />
      </>
    );
  }
  return (
    <Button variant="ghost" size="sm" asChild className={cn("-ml-2.5", next.days <= 7 ? "text-primary" : "text-muted-foreground")}>
      <Link href={examHref(next.exam)}>
        <CalendarIcon />
        {next.exam.name} {eventWhen(next.exam)}
        {!onNow(next.exam) && <span className="text-muted-foreground">· {eventDateLabel(next.exam)}</span>}
      </Link>
    </Button>
  );
}

/* ---------- today's plan ---------- */

/** "Final stretch" in the last days, "Final week" before that. */
const stageLabel = (plan: DayPlan) => (plan.stage === "final" ? "Final stretch" : plan.stage === "learn" && plan.days <= 7 ? "Final week" : null);

/** Today's plan toward an event, ticked off as it's done, with the button for the next thing.
    With `subject`, just that subject's share of it. */
export function ExamPlan({
  exam,
  overview,
  spaces,
  subject,
  named,
  className,
}: {
  exam: Exam;
  overview: StudyOverview;
  spaces: Space[];
  subject?: Space;
  /** Names the event in the heading, where other events sit beside it. */
  named?: boolean;
  className?: string;
}) {
  const covered = subject ? [subject] : examSubjects(exam, spaces);
  const decks = subject ? subjectDecks(overview.decks, subject) : decksIn(overview.decks, covered);
  const scope = subject ? { subject: subject.id } : examScope(exam);
  const plan = useDayPlan({ key: subject ? `${exam.id}:${subject.id}` : exam.id, days: eventDays(exam), scope, decks, weakTopics: overview.weakTopics });
  const cards = decks.reduce((n, d) => n + d.payload.cards.length, 0);
  const label = stageLabel(plan);

  if (cards === 0) {
    return (
      <div className={className}>
        <p className="text-lg font-medium text-balance">
          {covered.length
            ? `Add notes to ${covered.map((s) => s.name).join(" and ")}, and your buddy plans each day up to ${exam.name}.`
            : "Just a countdown for now. Link the subjects it covers and your buddy plans each day up to it."}
        </p>
        {!covered.length && !subject && (
          <Button variant="glass" asChild className="mt-4">
            <Link href={examHref(exam)}>
              <LinkIcon />
              Link subjects
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex items-center gap-2">
        <p className="font-semibold">{named ? `Today, for ${exam.name}` : plan.stage === "day" ? "On the day" : "Today"}</p>
        {label && (
          <Badge variant="secondary" className="rounded-full">
            {label}
          </Badge>
        )}
      </div>
      {plan.tasks.length > 0 && (
        <ul className="grid gap-0.5">
          {plan.tasks.map((task) => (
            <li key={task.key}>
              <Link href={task.href} className="group/task -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-foreground/5">
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full transition-colors duration-300",
                    task.done ? "bg-success text-white" : "ring-[1.5px] ring-foreground/25 ring-inset"
                  )}
                  aria-hidden
                >
                  {task.done && <CheckIcon className="size-3.5" strokeWidth={3} />}
                </span>
                <span className={cn("min-w-0 flex-1", task.done && "text-muted-foreground line-through")}>{task.label}</span>
                {task.progress && <span className="text-sm text-muted-foreground tabular-nums">{task.progress}</span>}
                {!task.done && <ChevronRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/task:opacity-100" />}
                {task.done && <span className="sr-only">(done)</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {(plan.stage === "day" || !plan.next) && (
        <p className="text-muted-foreground text-balance">
          {plan.stage === "day"
            ? plan.next
              ? "Keep it light today, then rest. Good luck!"
              : "You've done the work. Rest up, and good luck!"
            : plan.tasks.length
              ? "That's today done. See you tomorrow."
              : "Nothing due today. You're ahead of the plan."}
        </p>
      )}
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        {plan.next ? (
          <Button size="lg" asChild className="h-12 px-6 text-base">
            <Link href={plan.next.href}>
              <PlayIcon />
              {plan.next.key === "exam" ? "Start practice exam" : plan.next.key === "weak" ? plan.next.label : "Start studying"}
            </Link>
          </Button>
        ) : (
          plan.stage !== "day" && (
            <Button variant="glass" size="lg" asChild className="h-12 px-6 text-base">
              <Link href={sessionHref(scope)}>Keep practising</Link>
            </Button>
          )
        )}
        {/* A practice exam is always there, even before the plan calls for one */}
        {plan.stage === "learn" && cards >= 3 && !plan.tasks.some((t) => t.key === "exam") && (
          <Button variant="glass" size="lg" asChild className="h-12 px-6 text-base">
            <Link href={practiceHref(scope)}>
              <GraduationCapIcon />
              Practice exam
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/** An event's countdown beside today's plan. `linked` names the event and links to its page. */
export function ExamCountdown({
  exam,
  days,
  overview,
  spaces,
  linked,
  className,
}: {
  exam: Exam;
  days: number;
  overview: StudyOverview;
  spaces: Space[];
  linked?: boolean;
  className?: string;
}) {
  const covered = examSubjects(exam, spaces);
  return (
    <section aria-labelledby={`countdown-${exam.id}`} className={cn(groupClass, "rounded-2xl p-6 sm:p-8", className)}>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="shrink-0 sm:w-44">
          {linked && (
            <Link href={examHref(exam)} className="group/exam flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <span className="truncate">{exam.name}</span>
              <ChevronRightIcon className="size-3.5 shrink-0 transition-transform duration-150 group-hover/exam:translate-x-0.5" />
            </Link>
          )}
          <h2 id={`countdown-${exam.id}`} className={cn(linked && "mt-1")}>
            {days === 0 ? (
              <span className="block text-4xl font-bold tracking-tight">{onNow(exam) ? "On now" : "Today"}</span>
            ) : (
              <>
                <span className="block text-5xl font-bold tracking-tight tabular-nums">{days}</span>
                <span className="mt-1 block text-muted-foreground">{days === 1 ? "day to go" : "days to go"}</span>
              </>
            )}
          </h2>
          {/* On its own page the header already says when and what */}
          {linked && (
            <p className="mt-2 text-xs text-muted-foreground">
              {eventDateLabel(exam)}
              {covered.length > 0 && ` · ${covered.map((s) => s.name).join(", ")}`}
            </p>
          )}
        </div>
        <ExamPlan exam={exam} overview={overview} spaces={spaces} className="min-w-0 flex-1 border-glass-divider max-sm:border-t max-sm:pt-5 sm:border-l sm:pl-8" />
      </div>
    </section>
  );
}

/** An event as a card, laid out like a subject's card on Today: days left, what it covers, how ready you are, and what to do next. */
export function EventCard({ exam, days, overview, spaces, className }: { exam: Exam; days: number; overview: StudyOverview; spaces: Space[]; className?: string }) {
  const covered = examSubjects(exam, spaces);
  const decks = decksIn(overview.decks, covered);
  const plan = useDayPlan({ key: exam.id, days, scope: examScope(exam), decks, weakTopics: overview.weakTopics });
  const cards = decks.reduce((n, d) => n + d.payload.cards.length, 0);
  const counts = cardCounts(decks);
  const learned = Math.max(0, cards - counts.review - counts.fresh);
  const left = plan.tasks.filter((t) => !t.done).length;

  const status = !covered.length
    ? "Just a countdown"
    : cards === 0
      ? "No flashcards yet"
      : plan.stage === "day"
        ? "It's today. Good luck!"
        : left
          ? `${left} ${left === 1 ? "thing" : "things"} to do today`
          : "Done for today";

  return (
    <div className={cn(groupClass, "group/card relative flex min-h-44 flex-col rounded-2xl p-5 transition-colors duration-150 hover:bg-glass-strong", className)}>
      <Link href={examHref(exam)} className="absolute inset-0 rounded-2xl" aria-label={`Open ${exam.name}`} />
      <div className="flex items-baseline gap-3">
        <p className="min-w-0 flex-1 truncate text-lg font-semibold">{exam.name}</p>
        <span className={cn("shrink-0 text-sm font-medium tabular-nums", days <= 7 ? "text-primary" : "text-muted-foreground")}>
          {days === 0 ? (onNow(exam) ? "On now" : "Today") : `${days} ${days === 1 ? "day" : "days"}`}
        </span>
      </div>
      <p className="mt-0.5 truncate text-sm text-muted-foreground">
        {eventDateLabel(exam)}
        {covered.length > 0 && ` · ${covered.map((s) => s.name).join(", ")}`}
      </p>
      {cards > 0 && (
        <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-label={`${learned} of ${cards} learned`}>
          <div className="bg-success" style={{ width: `${(learned / cards) * 100}%` }} />
          <div className="bg-primary" style={{ width: `${(counts.review / cards) * 100}%` }} />
        </div>
      )}
      <p className={cn("mt-3 text-sm", !covered.length && "text-muted-foreground")}>{status}</p>
      <div className="relative mt-auto pt-4">
        {!covered.length ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={examHref(exam)}>
              <LinkIcon />
              Link subjects
            </Link>
          </Button>
        ) : (
          plan.next && (
            <Button size="sm" asChild>
              <Link href={plan.next.href}>
                <PlayIcon />
                Study
              </Link>
            </Button>
          )
        )}
      </div>
    </div>
  );
}

/* On Today: what's next, and getting you studying for it. The soonest event is the wide
   card, with its countdown and today's plan; the next ones are small cards beside it. */
export function ComingUp({
  events,
  overview,
  spaces,
  className,
}: {
  events: { exam: Exam; days: number }[];
  overview: StudyOverview;
  spaces: Space[];
  className?: string;
}) {
  const [lead, ...rest] = events;
  const others = rest.slice(0, 2);
  const [adding, setAdding] = useState(false);
  return (
    <section aria-labelledby="coming-up" className={className}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="coming-up" className="text-xl font-semibold">
          Coming up
        </h2>
        <div className="flex gap-2">
          <Button variant="glass" size="sm" asChild>
            <Link href="/events">All events</Link>
          </Button>
          <Button size="sm" onClick={() => setAdding(true)}>
            <PlusIcon />
            Add event
          </Button>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ExamCountdown exam={lead.exam} days={lead.days} overview={overview} spaces={spaces} linked className={others.length ? "lg:col-span-2" : "lg:col-span-3"} />
        {others.length > 0 && (
          // Beside it, the next events, sharing the column's height
          <div className="flex flex-col gap-4 max-lg:grid max-lg:sm:grid-cols-2">
            {others.map(({ exam, days }) => (
              <EventCard key={exam.id} exam={exam} days={days} overview={overview} spaces={spaces} className="flex-1" />
            ))}
          </div>
        )}
      </div>
      <ExamDialog open={adding} onOpenChange={setAdding} />
    </section>
  );
}

/** Once the day has passed: how did it go? Answering ends the countdown. */
export function ExamOutcome({ exam, className }: { exam: Exam; className?: string }) {
  const { save } = useExamWrites();
  const buddy = useQuery(petQuery).data?.name ?? "Your buddy";
  const answer = (outcome: "good" | "rough") =>
    save.mutate(
      { ...exam, outcome },
      {
        onSuccess: () =>
          toast.success(outcome === "good" ? `Congrats! ${buddy} is proud of you.` : "That's okay. Your notes and cards are here whenever you're ready."),
      }
    );

  return (
    <section aria-labelledby={`outcome-${exam.id}`} className={cn(groupClass, "rounded-2xl p-6", className)}>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="min-w-56 flex-1">
          <h2 id={`outcome-${exam.id}`} className="text-lg font-semibold">
            How did {exam.name} go?
          </h2>
          <p className="text-muted-foreground">
            {eventDateLabel(exam)}, {eventWhen(exam)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={save.isPending} onClick={() => answer("rough")}>
            Not great
          </Button>
          <Button disabled={save.isPending} onClick={() => answer("good")}>
            It went well
          </Button>
        </div>
      </div>
    </section>
  );
}
