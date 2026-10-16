"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarIcon, CalendarPlusIcon, CheckIcon, ChevronRightIcon, GraduationCapIcon, PlayIcon } from "lucide-react";
import {
  decksIn,
  examDateLabel,
  examHref,
  examScope,
  examSubjects,
  fromDateKey,
  nextExamFor,
  practiceHref,
  toDateKey,
  useDayPlan,
  useExams,
  whenLine,
  type DayPlan,
  type Exam,
} from "@/lib/exams";
import { petQuery, spacesQuery } from "@/lib/queries";
import { sessionHref, subjectDecks } from "@/lib/subjects";
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
    onError: (e) => toast.error(e.message || "Couldn't save the exam. Try again."),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteExam(id);
      if (!result.ok) throw new Error(result.message);
      put(result.exams);
    },
    onError: (e) => toast.error(e.message || "Couldn't delete the exam. Try again."),
  });
  return { save, remove };
}

export const useDeleteExam = () => useExamWrites().remove;

/* ---------- adding and editing ---------- */

/** Adds an exam, or edits one: its name, day and the subjects it covers. */
export function ExamDialog({
  exam,
  subjectIds,
  open,
  onOpenChange,
  onSaved,
}: {
  exam?: Exam;
  /** Subjects ticked to start with, for a new exam. */
  subjectIds?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (exam: Exam) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass flex max-h-[90dvh] flex-col gap-0 border border-glass-border bg-glass-strong p-0 sm:max-w-md">
        {/* Remounted on each open, so the fields start from the saved exam */}
        {open && <ExamForm exam={exam} subjectIds={subjectIds} onDone={(saved) => (onOpenChange(false), onSaved?.(saved))} />}
      </DialogContent>
    </Dialog>
  );
}

function ExamForm({ exam, subjectIds, onDone }: { exam?: Exam; subjectIds?: string[]; onDone: (exam: Exam) => void }) {
  const { save } = useExamWrites();
  const spaces = useQuery(spacesQuery).data ?? [];
  const uid = useId();
  const [name, setName] = useState(exam?.name ?? "");
  const [date, setDate] = useState<Date | undefined>(exam ? fromDateKey(exam.date) : undefined);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(exam?.spaceIds ?? subjectIds ?? (spaces.length === 1 ? [spaces[0].id] : [])));
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
        if (!date || !picked.size) return;
        // Moving the date starts the countdown again, even after it was answered
        save.mutate(
          { id: exam?.id, name, date: toDateKey(date), spaceIds: [...picked], outcome: exam && toDateKey(date) === exam.date ? exam.outcome : undefined },
          { onSuccess: (saved) => (toast.success(`${saved.name} set for ${examDateLabel(saved.date)}`), onDone(saved)) }
        );
      }}
    >
      <DialogHeader className="border-b border-glass-divider p-6">
        <DialogTitle>{exam ? "Edit exam" : "Add an exam"}</DialogTitle>
        <DialogDescription>Your buddy plans each day up to it, from the subjects it covers.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${uid}-name`}>Name</FieldLabel>
            <Input
              id={`${uid}-name`}
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="For example: Board exam"
              className="h-10 rounded-xl bg-popover"
            />
          </Field>
          <Field>
            <FieldLabel>Date</FieldLabel>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={{ before: today }}
              startMonth={today}
              defaultMonth={date ?? today}
              className="mx-auto rounded-xl bg-transparent [--cell-size:--spacing(9)]"
            />
          </Field>
          <FieldSet>
            <FieldLegend variant="label">Subjects it covers</FieldLegend>
            {spaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a subject first, with the notes for this exam.</p>
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
          </FieldSet>
        </FieldGroup>
      </div>
      <DialogFooter className="m-0 flex-row items-center justify-end border-t border-glass-divider bg-transparent px-6 py-5">
        <Button type="submit" disabled={!date || !picked.size || save.isPending}>
          {save.isPending && <Spinner />}
          {exam ? "Save" : "Add exam"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** An invitation to add an exam, where there isn't one yet. */
export function ExamPrompt({ subjectId, className }: { subjectId?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const buddy = useQuery(petQuery).data?.name ?? "your buddy";
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3", className)}>
      <CalendarPlusIcon className="size-5 shrink-0 text-primary" aria-hidden />
      <p className="min-w-48 flex-1 text-muted-foreground">Have an exam coming? Add the date and {buddy} plans each day up to it.</p>
      <Button variant="glass" onClick={() => setOpen(true)}>
        Add exam
      </Button>
      <ExamDialog open={open} onOpenChange={setOpen} subjectIds={subjectId ? [subjectId] : undefined} />
    </div>
  );
}

/** In a subject's header: its next exam, or a way to add one. */
export function ExamChip({ space }: { space: Space }) {
  const next = nextExamFor(useExams(), space.id);
  const [open, setOpen] = useState(false);
  if (!next) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="-ml-2.5 text-muted-foreground">
          <CalendarPlusIcon />
          Add an exam
        </Button>
        <ExamDialog open={open} onOpenChange={setOpen} subjectIds={[space.id]} />
      </>
    );
  }
  return (
    <Button variant="ghost" size="sm" asChild className={cn("-ml-2.5", next.days <= 7 ? "text-primary" : "text-muted-foreground")}>
      <Link href={examHref(next.exam)}>
        <CalendarIcon />
        {next.exam.name} {whenLine(next.days)}
        <span className="text-muted-foreground">· {examDateLabel(next.exam.date)}</span>
      </Link>
    </Button>
  );
}

/* ---------- today's plan ---------- */

/** "Final stretch" in the last days, "Final week" before that. */
const stageLabel = (plan: DayPlan) => (plan.stage === "final" ? "Final stretch" : plan.stage === "learn" && plan.days <= 7 ? "Final week" : null);

/** Today's plan toward an exam, ticked off as it's done, with the button for the next thing.
    With `subject`, just that subject's share of it. */
export function ExamPlan({ exam, overview, spaces, subject, className }: { exam: Exam; overview: StudyOverview; spaces: Space[]; subject?: Space; className?: string }) {
  const covered = subject ? [subject] : examSubjects(exam, spaces);
  const decks = subject ? subjectDecks(overview.decks, subject) : decksIn(overview.decks, covered);
  const scope = subject ? { subject: subject.id } : examScope(exam);
  const plan = useDayPlan({ key: subject ? `${exam.id}:${subject.id}` : exam.id, date: exam.date, scope, decks, weakTopics: overview.weakTopics });
  const cards = decks.reduce((n, d) => n + d.payload.cards.length, 0);
  const label = stageLabel(plan);

  if (cards === 0) {
    return (
      <div className={className}>
        <p className="text-lg font-medium text-balance">
          {covered.length
            ? `Add notes to ${covered.map((s) => s.name).join(" and ")}, and your buddy plans each day up to the exam.`
            : "Pick the subjects this exam covers, and your buddy plans each day up to it."}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex items-center gap-2">
        <p className="font-semibold">{plan.stage === "day" ? "Exam day" : "Today"}</p>
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

/** An exam's countdown beside today's plan. `linked` names the exam and links to its page. */
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
              <span className="block text-4xl font-bold tracking-tight">Today</span>
            ) : (
              <>
                <span className="block text-5xl font-bold tracking-tight tabular-nums">{days}</span>
                <span className="mt-1 block text-muted-foreground">{days === 1 ? "day to go" : "days to go"}</span>
              </>
            )}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {examDateLabel(exam.date)}
            {covered.length > 0 && ` · ${covered.map((s) => s.name).join(", ")}`}
          </p>
        </div>
        <ExamPlan exam={exam} overview={overview} spaces={spaces} className="min-w-0 flex-1 border-glass-divider max-sm:border-t max-sm:pt-5 sm:border-l sm:pl-8" />
      </div>
    </section>
  );
}

/** Once the day has passed: how did it go? Answering ends the countdown. */
export function ExamOutcome({ exam, days, className }: { exam: Exam; days: number; className?: string }) {
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
            {examDateLabel(exam.date)}, {whenLine(days)}
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
