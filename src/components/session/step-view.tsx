"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, CircleDashedIcon, RotateCcwIcon, XIcon } from "lucide-react";
import type { AttemptResult, CheckResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Step } from "./plan";

const MODE_HINT: Record<Step["mode"], string> = {
  cards: "Answer in your head, then flip.",
  quiz: "Pick the right answer.",
  recall: "Type it in your own words. Your buddy checks it against your notes.",
};

const REASON_LABEL: Record<Step["reason"], string> = {
  due: "Review",
  weak: "Weak topic",
  new: "New",
  again: "Missed earlier",
};

type Props = {
  step: Step;
  /** The answer's been given: right, almost or wrong. */
  onAnswer: (result: AttemptResult) => void;
  onNext: () => void;
};

/** One step of a session: a flip card, a multiple-choice question, or a typed answer. */
export function StepView({ step, onAnswer, onNext }: Props) {
  const { card } = step.item;
  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate font-medium">{card.topic || "Question"}</span>
        <span className="shrink-0">{REASON_LABEL[step.reason]}</span>
      </div>
      {step.mode === "cards" && <FlipStep step={step} onAnswer={onAnswer} onNext={onNext} />}
      {step.mode === "quiz" && <QuizStep step={step} onAnswer={onAnswer} onNext={onNext} />}
      {step.mode === "recall" && <RecallStep step={step} onAnswer={onAnswer} onNext={onNext} />}
      <p className="text-center text-xs text-muted-foreground">{MODE_HINT[step.mode]}</p>
    </div>
  );
}

// Keys typed into a text box belong to it, not to the card
const typing = (e: KeyboardEvent) => e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;

/* ---------- flip ---------- */

function FlipStep({ step, onAnswer, onNext }: Props) {
  const [flipped, setFlipped] = useState(false);
  const { card, source } = step.item;
  const rate = (knew: boolean) => {
    onAnswer(knew ? "right" : "wrong");
    onNext();
  };

  // Space flips, 1 is Again, 2 is Got it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && e.key === "1") rate(false);
      else if (flipped && e.key === "2") rate(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show the question" : "Show the answer"}
        className="perspective-[1400px] rounded-3xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div
          className={cn(
            "relative grid min-h-72 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform-3d motion-reduce:transition-none",
            flipped && "rotate-y-180"
          )}
        >
          <Face>{card.front}</Face>
          <Face back source={source}>
            {card.back}
          </Face>
        </div>
      </button>
      {flipped ? (
        <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-150 motion-reduce:animate-none">
          <Button variant="outline" size="lg" className="h-12" onClick={() => rate(false)}>
            <RotateCcwIcon />
            Again
          </Button>
          <Button size="lg" className="h-12" onClick={() => rate(true)}>
            <CheckIcon />
            Got it
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="lg" className="h-12" onClick={() => setFlipped(true)}>
          Show answer
        </Button>
      )}
    </>
  );
}

function Face({ back = false, source, children }: { back?: boolean; source?: string | null; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "col-start-1 row-start-1 flex flex-col rounded-3xl border border-border p-8 backface-hidden",
        back ? "rotate-y-180 bg-primary/5" : "bg-card"
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{back ? "Answer" : "Question"}</span>
      <p className="my-auto py-6 text-center text-2xl leading-snug font-medium text-balance">{children}</p>
      {back && source && <span className="truncate text-xs text-muted-foreground">From {source}</span>}
    </div>
  );
}

/* ---------- multiple choice ---------- */

function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function QuizStep({ step, onAnswer, onNext }: Props) {
  const { card, source } = step.item;
  const choices = useMemo(() => shuffle([card.back, ...card.wrong]), [card]);
  const [picked, setPicked] = useState<string | null>(null);

  const choose = (choice: string) => {
    if (picked) return;
    setPicked(choice);
    onAnswer(choice === card.back ? "right" : "wrong");
  };

  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => e.key === "Enter" && !typing(e) && onNext();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked, onNext]);

  return (
    <>
      <div className="rounded-3xl border border-border bg-card p-8">
        <p className="text-2xl leading-snug font-medium text-balance">{card.front}</p>
      </div>
      <div className="grid gap-2" role="group" aria-label="Choices">
        {choices.map((choice) => {
          const right = choice === card.back;
          const state = !picked ? "idle" : right ? "right" : choice === picked ? "wrong" : "idle";
          return (
            <Button
              key={choice}
              variant="outline"
              onClick={() => choose(choice)}
              aria-disabled={!!picked}
              className={cn(
                "h-auto min-h-12 justify-start gap-3 py-3 text-left text-base font-normal whitespace-normal transition-colors duration-150",
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
      {picked && <NextRow source={source} onNext={onNext} />}
    </>
  );
}

/* ---------- typed answer, checked against the notes ---------- */

async function check(step: Step, answer: string): Promise<CheckResult> {
  const res = await fetch("/api/study/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ deckId: step.item.deckId, index: step.item.index, answer }] }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't check your answer. Try again.");
  const [result] = (await res.json()) as CheckResult[];
  return result;
}

function RecallStep({ step, onAnswer, onNext }: Props) {
  const { card, source } = step.item;
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (answer: string) => {
    setChecking(true);
    setError(null);
    try {
      const r = await check(step, answer);
      setResult(r);
      onAnswer(r.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => e.key === "Enter" && !typing(e) && onNext();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, onNext]);

  return (
    <>
      <div className="rounded-3xl border border-border bg-card p-8">
        <p className="text-2xl leading-snug font-medium text-balance">{card.front}</p>
      </div>
      {result ? (
        <div className="grid gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
          <div
            className={cn(
              "rounded-2xl border p-4",
              result.result === "right" ? "border-success/50 bg-success/10" : result.result === "almost" ? "border-amber-500/50 bg-amber-500/10" : "border-destructive/50 bg-destructive/10"
            )}
          >
            <div className="flex items-start gap-2.5">
              <ResultIcon result={result.result} />
              <div className="grid gap-1">
                {draft.trim() && <p className="text-sm text-muted-foreground">You: {draft}</p>}
                <p>{result.feedback}</p>
              </div>
            </div>
          </div>
          {result.result !== "right" && (
            <p className="text-sm">
              <span className="text-muted-foreground">Answer: </span>
              {card.back}
            </p>
          )}
          <NextRow source={source} onNext={onNext} />
        </div>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) void submit(draft);
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (draft.trim()) void submit(draft);
              }
            }}
            aria-label="Your answer"
            placeholder="Your answer"
            autoFocus
            disabled={checking}
            className="min-h-24 rounded-2xl text-base"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" disabled={checking} onClick={() => void submit("")}>
              I don&apos;t know
            </Button>
            <Button type="submit" size="lg" disabled={checking || !draft.trim()}>
              {checking ? <Spinner /> : null}
              {checking ? "Checking against your notes…" : "Check answer"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}

function ResultIcon({ result }: { result: AttemptResult }) {
  if (result === "right") return <CheckIcon aria-label="Right" className="mt-0.5 size-5 shrink-0 text-success" />;
  if (result === "almost") return <CircleDashedIcon aria-label="Almost" className="mt-0.5 size-5 shrink-0 text-amber-500" />;
  return <XIcon aria-label="Wrong" className="mt-0.5 size-5 shrink-0 text-destructive" />;
}

function NextRow({ source, onNext }: { source: string | null; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 animate-in fade-in duration-150 motion-reduce:animate-none">
      <p className="min-w-0 truncate text-xs text-muted-foreground">{source && `From ${source}`}</p>
      <Button size="lg" onClick={onNext}>
        Next
      </Button>
    </div>
  );
}
