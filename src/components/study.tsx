"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { isDue, rate } from "@/lib/leitner";
import type { CardProgress, Flashcard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type StudyMode = "cards" | "quiz";

type StudyProps = {
  mode: StudyMode | null;
  onClose: () => void;
  title: string;
  cards: Flashcard[];
  progress: Record<string, CardProgress>;
  onRate: (index: number, progress: CardProgress) => void;
  sourceLabel: (card: Flashcard) => string | null;
};

/** Studying a deck: flip cards with spaced repetition, or a multiple-choice quiz. */
export function StudyDialog({ mode, onClose, title, ...props }: StudyProps) {
  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="gap-6 sm:max-w-lg"
        // Focus the dialog itself, so the first card or choice doesn't open looking picked
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "quiz" ? "Pick the right answer." : "Answer in your head, then flip the card."}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so each opening starts a fresh session */}
        {mode === "cards" && <CardSession key="cards" onClose={onClose} {...props} />}
        {mode === "quiz" && <QuizSession key="quiz" onClose={onClose} {...props} />}
      </DialogContent>
    </Dialog>
  );
}

type SessionProps = Omit<StudyProps, "mode" | "title">;

function CardSession({ cards, progress, onRate, sourceLabel, onClose }: SessionProps) {
  // Due cards first; if nothing is due, the whole deck
  const [queue, setQueue] = useState(() => {
    const due = cards.map((_, i) => i).filter((i) => isDue(progress[i]));
    return due.length ? due : cards.map((_, i) => i);
  });
  const [total] = useState(queue.length);
  const [flipped, setFlipped] = useState(false);
  const [gotIt, setGotIt] = useState(0);
  const current = queue[0];
  const card = current === undefined ? null : cards[current];

  const answer = (knew: boolean) => {
    if (current === undefined) return;
    onRate(current, rate(progress[current], knew));
    setFlipped(false);
    // A missed card comes back at the end of this session
    setQueue((q) => (knew ? q.slice(1) : [...q.slice(1), current]));
    if (knew) setGotIt((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && e.key === "1") answer(false);
      else if (flipped && e.key === "2") answer(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) {
    return <Finished line={`You got all ${total} ${total === 1 ? "card" : "cards"}.`} note="Cards you know come back later, so you review them just before you'd forget." onClose={onClose} />;
  }

  return (
    <div className="grid gap-5">
      <Progress value={gotIt} max={total} label={`${gotIt} of ${total}`} />
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show the question" : "Show the answer"}
        className="group perspective-[1200px] rounded-2xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div
          className={cn(
            "relative grid min-h-56 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform-3d motion-reduce:transition-none",
            flipped && "rotate-y-180"
          )}
        >
          <Face label="Question">{card.front}</Face>
          <Face label="Answer" back source={sourceLabel(card)}>
            {card.back}
          </Face>
        </div>
      </button>
      {flipped ? (
        <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-150 motion-reduce:animate-none">
          <Button variant="outline" size="lg" onClick={() => answer(false)}>
            <RotateCcwIcon />
            Again
          </Button>
          <Button size="lg" onClick={() => answer(true)}>
            <CheckIcon />
            Got it
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="lg" onClick={() => setFlipped(true)}>
          Show answer
        </Button>
      )}
    </div>
  );
}

function Face({ label, back = false, source, children }: { label: string; back?: boolean; source?: string | null; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "col-start-1 row-start-1 flex flex-col rounded-2xl border border-border p-6 backface-hidden",
        back ? "rotate-y-180 bg-primary/5" : "bg-card"
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <p className="my-auto py-4 text-center text-lg leading-snug font-medium text-balance">{children}</p>
      {source && <span className="truncate text-xs text-muted-foreground">From {source}</span>}
    </div>
  );
}

const QUIZ_LENGTH = 10;

function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function QuizSession({ cards, sourceLabel, onClose }: SessionProps) {
  // Cards without wrong answers can't be asked as multiple choice
  const questions = useMemo(
    () =>
      shuffle(cards.filter((c) => c.wrong.length > 0))
        .slice(0, QUIZ_LENGTH)
        .map((card) => ({ card, choices: shuffle([card.back, ...card.wrong]) })),
    [cards]
  );
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const q = questions[step];

  if (questions.length === 0) {
    return <Finished line="This deck has no quiz questions." note="Study it as flashcards instead." onClose={onClose} />;
  }
  if (!q) {
    return (
      <Finished
        line={`You got ${score} of ${questions.length} right.`}
        note={score === questions.length ? "A perfect score." : "Study the deck as flashcards to go over the ones you missed."}
        onClose={onClose}
      />
    );
  }

  const choose = (choice: string) => {
    if (picked) return;
    setPicked(choice);
    if (choice === q.card.back) setScore((s) => s + 1);
  };
  const source = sourceLabel(q.card);

  return (
    <div className="grid gap-5">
      <Progress value={step} max={questions.length} label={`Question ${step + 1} of ${questions.length}`} />
      <p className="text-lg leading-snug font-medium text-balance">{q.card.front}</p>
      <div className="grid gap-2" role="group" aria-label="Choices">
        {q.choices.map((choice) => {
          const right = choice === q.card.back;
          const state = !picked ? "idle" : right ? "right" : choice === picked ? "wrong" : "idle";
          return (
            <Button
              key={choice}
              variant="outline"
              onClick={() => choose(choice)}
              aria-disabled={!!picked}
              data-state={state}
              className={cn(
                "h-auto justify-start gap-3 py-3 text-left font-normal whitespace-normal transition-colors duration-150",
                state === "right" && "border-success bg-success/10 text-foreground",
                state === "wrong" && "border-destructive bg-destructive/10 text-foreground",
                picked && state === "idle" && "opacity-60"
              )}
            >
              <span className="flex-1">{choice}</span>
              {state === "right" && <CheckIcon className="text-success" />}
              {state === "wrong" && <XIcon className="text-destructive" />}
            </Button>
          );
        })}
      </div>
      {picked && (
        <div className="flex items-center justify-between gap-4 animate-in fade-in duration-150 motion-reduce:animate-none">
          <p className="min-w-0 truncate text-xs text-muted-foreground">{source && `From ${source}`}</p>
          <Button
            onClick={() => {
              setPicked(null);
              setStep((s) => s + 1);
            }}
          >
            {step + 1 === questions.length ? "See score" : "Next"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="grid gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label={label} className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

function Finished({ line, note, onClose }: { line: string; note: string; onClose: () => void }) {
  return (
    <div className="grid justify-items-center gap-2 py-6 text-center animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none">
      <p className="text-xl font-semibold tracking-tight">{line}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{note}</p>
      <Button className="mt-4" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

