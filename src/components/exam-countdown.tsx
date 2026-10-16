"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarIcon, CalendarPlusIcon, CheckIcon, ChevronRightIcon, GraduationCapIcon, PlayIcon } from "lucide-react";
import { daysUntil, examDateLabel, fromDateKey, toDateKey, useDayPlan, whenLine, type DayPlan, type ExamDate } from "@/lib/exams";
import { petQuery } from "@/lib/queries";
import { sessionHref, subjectDecks } from "@/lib/subjects";
import type { Space, StudyOverview } from "@/lib/types";
import { cn } from "@/lib/utils";
import { setExam } from "@/lib/writes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const groupClass = "glass rounded-xl border border-glass-border bg-glass";

/** Saves a subject's exam, and puts it straight into the signed-in user. */
function useSaveExam(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (exam: ExamDate | null) => {
      const result = await setExam(spaceId, exam);
      if (!result.ok) throw new Error(result.message);
      return result.exams;
    },
    onSuccess: (exams) =>
      queryClient.setQueryData(["me"], (me: unknown) =>
        me && typeof me === "object" ? { ...me, user_metadata: { ...(me as { user_metadata?: object }).user_metadata, exams } } : me
      ),
    onError: (e) => toast.error(e.message || "Couldn't save the exam date. Try again."),
  });
}

/** Sets, moves or removes a subject's exam date. */
export function ExamDateDialog({ space, exam, open, onOpenChange }: { space: Space; exam?: ExamDate; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass gap-0 border border-glass-border bg-glass-strong p-0 sm:max-w-sm">
        {/* Remounted on each open, so the fields start from the saved exam */}
        {open && <ExamForm space={space} exam={exam} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ExamForm({ space, exam, onDone }: { space: Space; exam?: ExamDate; onDone: () => void }) {
  const save = useSaveExam(space.id);
  const uid = useId();
  // A finished exam starts the form fresh, for the next one
  const current = exam && !exam.outcome ? exam : undefined;
  const [name, setName] = useState(current?.name ?? "");
  const [date, setDate] = useState<Date | undefined>(current ? fromDateKey(current.date) : undefined);
  const [today] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!date) return;
        save.mutate(
          { date: toDateKey(date), name: name.trim() || "Exam" },
          { onSuccess: () => (toast.success(`${name.trim() || "Exam"} set for ${examDateLabel(toDateKey(date))}`), onDone()) }
        );
      }}
    >
      <DialogHeader className="border-b border-glass-divider p-6">
        <DialogTitle>{current ? "Exam date" : "Set an exam date"}</DialogTitle>
        <DialogDescription>Your buddy plans each day of {space.name} up to it.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="p-6">
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
      </FieldGroup>
      <DialogFooter className="m-0 flex-row items-center justify-between border-t border-glass-divider bg-transparent px-6 py-5 sm:justify-between">
        {current ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={save.isPending}
            onClick={() => save.mutate(null, { onSuccess: () => (toast.success("Exam date removed"), onDone()) })}
          >
            Remove
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={!date || save.isPending}>
          {save.isPending && <Spinner />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

/** In a subject's header: when its exam is, or a way to set one. */
export function ExamChip({ exam, onClick }: { exam?: ExamDate; onClick: () => void }) {
  if (!exam || exam.outcome) {
    return (
      <Button variant="ghost" size="sm" onClick={onClick} className="-ml-2.5 text-muted-foreground">
        <CalendarPlusIcon />
        Set an exam date
      </Button>
    );
  }
  const days = daysUntil(exam.date);
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className={cn("-ml-2.5", days >= 0 && days <= 7 ? "text-primary" : "text-muted-foreground")}>
      <CalendarIcon />
      {exam.name} {days < 0 ? `was ${whenLine(days)}` : whenLine(days)}
      <span className="text-muted-foreground">· {examDateLabel(exam.date)}</span>
    </Button>
  );
}

/** "Final stretch" in the last days, "Final week" before that. */
const stageLabel = (plan: DayPlan) => (plan.stage === "final" ? "Final stretch" : plan.stage === "learn" && plan.days <= 7 ? "Final week" : null);

/** Today's plan for a subject: what to do, ticked off as it's done, and the button for the next thing. */
export function ExamPlan({ space, exam, overview, className }: { space: Space; exam: ExamDate; overview: StudyOverview; className?: string }) {
  const plan = useDayPlan(space, exam, overview.decks, overview.weakTopics);
  const cards = subjectDecks(overview.decks, space).reduce((n, d) => n + d.payload.cards.length, 0);
  const label = stageLabel(plan);

  if (cards === 0) {
    return (
      <div className={className}>
        <p className="text-lg font-medium text-balance">Add notes to {space.name}, and your buddy plans each day up to the exam.</p>
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
      {plan.tasks.length > 0 ? (
        <ul className="grid gap-0.5">
          {plan.tasks.map((task) => (
            <li key={task.key}>
              <Link
                href={task.href}
                className="group/task -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-foreground/5"
              >
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
      ) : null}
      <p className="text-muted-foreground text-balance">
        {plan.stage === "day"
          ? plan.next
            ? "Keep it light today, then rest. Good luck!"
            : "You've done the work. Rest up, and good luck!"
          : plan.next
            ? null
            : plan.tasks.length
              ? "That's today done. See you tomorrow."
              : "Nothing due today. You're ahead of the plan."}
      </p>
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
              <Link href={sessionHref({ subject: space.id })}>Keep practising</Link>
            </Button>
          )
        )}
        {/* A practice exam is always there, even before the plan calls for one */}
        {plan.stage === "learn" && cards >= 3 && !plan.tasks.some((t) => t.key === "exam") && (
          <Button variant="glass" size="lg" asChild className="h-12 px-6 text-base">
            <Link href={`/exam?subject=${space.id}`}>
              <GraduationCapIcon />
              Practice exam
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/** On Today: the soonest exam, its countdown, and today's plan. */
export function ExamCard({ space, exam, days, overview }: { space: Space; exam: ExamDate; days: number; overview: StudyOverview }) {
  return (
    <section aria-labelledby="exam-countdown" className={`${groupClass} mt-8 rounded-2xl p-6 sm:p-8`}>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="shrink-0 sm:w-44">
          <Link href={`/spaces/${space.id}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
            {space.name}
          </Link>
          <h2 id="exam-countdown" className="mt-1">
            {days === 0 ? (
              <span className="block text-4xl font-bold tracking-tight">Today</span>
            ) : (
              <>
                <span className="block text-5xl font-bold tracking-tight tabular-nums">{days}</span>
                <span className="mt-1 block text-muted-foreground">
                  {days === 1 ? "day" : "days"} to {exam.name}
                </span>
              </>
            )}
            {days === 0 && <span className="mt-1 block text-muted-foreground">{exam.name}</span>}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">{examDateLabel(exam.date)}</p>
        </div>
        <ExamPlan space={space} exam={exam} overview={overview} className="min-w-0 flex-1 border-glass-divider max-sm:border-t max-sm:pt-5 sm:border-l sm:pl-8" />
      </div>
    </section>
  );
}

/** Once the day has passed: how did it go? Answering ends the countdown. */
export function ExamOutcome({ space, exam, days, className }: { space: Space; exam: ExamDate; days: number; className?: string }) {
  const save = useSaveExam(space.id);
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
    <section aria-labelledby={`outcome-${space.id}`} className={cn(groupClass, "rounded-2xl p-6", className)}>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="min-w-56 flex-1">
          <h2 id={`outcome-${space.id}`} className="text-lg font-semibold">
            How did {exam.name} go?
          </h2>
          <p className="text-muted-foreground">
            {space.name}, {whenLine(days)}
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
