"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, CircleDashedIcon, RotateCcwIcon, XIcon } from "lucide-react";
import type { AttemptResult, CheckResult, MissKind, PracticeQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Step } from "./plan";

const MODE_HINT: Record<Step["mode"], string> = {
  cards: "Answer in your head, then flip. Space flips, 1 is Again, 2 is Got it.",
  quiz: "Pick the right answer.",
  recall: "Answer in your own words. It's checked against your notes.",
  teach: "Explaining it back is how a muddled idea turns clear.",
  practice: "Using the idea again, a little differently, makes it stick.",
};

const CARD = "rounded-[28px] border border-border/60 bg-card shadow-xl shadow-black/10 dark:shadow-black/30";

const REASON_LABEL: Record<Step["reason"], string> = {
  due: "Review",
  weak: "Weak topic",
  new: "New",
  again: "Missed earlier",
  followup: "Follow-up",
};

type Props = {
  step: Step;
  /** The answer's been given: right, almost or wrong, with why it missed and what was typed, when known. */
  onAnswer: (result: AttemptResult, detail?: { miss?: MissKind; typed?: string }) => void;
  onNext: () => void;
  /** The subject, for explanations from its notes. */
  spaceId?: string;
  /** A card was turned over. */
  onFlip?: () => void;
};

/** One step of a session: a flip card, a multiple-choice question, or a typed answer. */
export function StepView({ step, onAnswer, onNext, spaceId, onFlip }: Props) {
  return (
    <div className="grid gap-5 animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none">
      {step.mode === "cards" && <FlipStep step={step} onAnswer={onAnswer} onNext={onNext} onFlip={onFlip} />}
      {step.mode === "quiz" && <QuizStep step={step} onAnswer={onAnswer} onNext={onNext} />}
      {step.mode === "recall" && <RecallStep step={step} onAnswer={onAnswer} onNext={onNext} />}
      {step.mode === "teach" && <TeachStep step={step} spaceId={spaceId} onAnswer={onAnswer} onNext={onNext} />}
      {step.mode === "practice" && <PracticeStep step={step} onAnswer={onAnswer} onNext={onNext} />}
      <p className="text-center text-xs text-muted-foreground">{MODE_HINT[step.mode]}</p>
    </div>
  );
}

/** The top of a card: its topic, and why it's in this session. */
function CardHead({ step, label }: { step: Step; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
      <span className="truncate">{label ?? (step.item.card.topic || "Question")}</span>
      {!label && <span className="shrink-0 rounded-full bg-foreground/5 px-2.5 py-1">{REASON_LABEL[step.reason]}</span>}
    </div>
  );
}

// Keys typed into a text box belong to it, not to the card
const typing = (e: KeyboardEvent) => e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;

/* ---------- flip ---------- */

function FlipStep({ step, onAnswer, onNext, onFlip }: Props) {
  const [flipped, setFlippedState] = useState(false);
  const setFlipped = (next: boolean | ((f: boolean) => boolean)) => {
    onFlip?.();
    setFlippedState(next);
  };
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
        className="w-full perspective-[1400px] rounded-[28px] text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div
          className={cn(
            "relative grid min-h-80 grid-cols-[minmax(0,1fr)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform-3d motion-reduce:transition-none",
            flipped && "rotate-y-180"
          )}
        >
          <Face head={<CardHead step={step} />}>{card.front}</Face>
          <Face back head={<CardHead step={step} label="Answer" />} source={source}>
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

function Face({ back = false, head, source, children }: { back?: boolean; head: React.ReactNode; source?: string | null; children: React.ReactNode }) {
  return (
    <div className={cn("col-start-1 row-start-1 flex flex-col p-6 backface-hidden sm:p-8", CARD, back && "rotate-y-180 bg-primary/[0.06]")}>
      {head}
      <p className="my-auto py-8 text-center text-2xl leading-snug font-semibold tracking-tight text-balance sm:text-3xl">{children}</p>
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
      <div className={cn("grid gap-6 p-6 sm:p-8", CARD)}>
        <CardHead step={step} />
        <p className="pb-2 text-2xl leading-snug font-semibold tracking-tight text-balance sm:text-3xl">{card.front}</p>
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
                "h-auto min-h-14 justify-start gap-3 rounded-2xl px-5 py-3.5 text-left text-base font-normal whitespace-normal transition-colors duration-150",
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
      onAnswer(r.result, { miss: r.miss, typed: answer });
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
      <div className={cn("grid gap-6 p-6 sm:p-8", CARD)}>
        <CardHead step={step} />
        <p className="pb-2 text-2xl leading-snug font-semibold tracking-tight text-balance sm:text-3xl">{card.front}</p>
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
            className="min-h-28 rounded-2xl p-4 text-base"
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

/* ---------- follow-up: explain it back (for a misunderstanding) ---------- */

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong. Try again.");
  return data as T;
}

const stripCitations = (text: string) => text.replace(/\s?\[\d+(?:,\s*\d+)*\]/g, "").trim();

function TeachStep({ step, spaceId, onAnswer, onNext }: Props) {
  const { card, source } = step.item;
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ result: AttemptResult; feedback: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Your buddy explains the idea first, from your notes
  useEffect(() => {
    let live = true;
    postJson<{ answer: string }>("/api/study/explain", {
      deckId: step.item.deckId,
      index: step.item.index,
      question: "Explain the idea behind this answer simply, in two or three sentences, so I understand it, not just remember it.",
      spaceId,
    })
      .then((r) => live && setExplanation(stripCitations(r.answer)))
      .catch((e: Error) => live && setLoadError(e.message));
    return () => {
      live = false;
    };
  }, [step.item.deckId, step.item.index, spaceId]);

  const submit = async () => {
    if (!draft.trim()) return;
    setChecking(true);
    setError(null);
    try {
      const r = await postJson<{ result: AttemptResult; feedback: string }>("/api/study/teachback", {
        deckId: step.item.deckId,
        index: step.item.index,
        explanation: draft,
      });
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
      <div className={cn("grid gap-5 p-6 sm:p-8", CARD)}>
        <CardHead step={step} />
        <p className="text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl">{card.front}</p>
        <div className="grid gap-1.5 rounded-2xl bg-primary/[0.06] p-4">
          <p className="text-xs font-medium text-primary">Here&apos;s the idea</p>
          {explanation ? (
            <p className="leading-relaxed animate-in fade-in duration-200 motion-reduce:animate-none">{explanation}</p>
          ) : loadError ? (
            <p className="text-sm text-muted-foreground">
              The answer is: <span className="text-foreground">{card.back}</span>
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Explaining from your notes…
            </p>
          )}
          {source && (explanation || loadError) && <p className="truncate text-xs text-muted-foreground">From {source}</p>}
        </div>
      </div>
      {result ? (
        <div className="grid gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-2xl border p-4",
              result.result === "right" ? "border-success/50 bg-success/10" : result.result === "almost" ? "border-amber-500/50 bg-amber-500/10" : "border-destructive/50 bg-destructive/10"
            )}
          >
            <ResultIcon result={result.result} />
            <p>{result.feedback}</p>
          </div>
          <NextRow source={null} onNext={onNext} />
        </div>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="text-sm font-medium">Now explain it back in your own words</p>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            aria-label="Your explanation"
            placeholder="As if you were teaching a friend"
            disabled={checking || (!explanation && !loadError)}
            className="min-h-28 rounded-2xl p-4 text-base"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" disabled={checking} onClick={onNext}>
              Skip
            </Button>
            <Button type="submit" size="lg" disabled={checking || !draft.trim()}>
              {checking ? <Spinner /> : null}
              {checking ? "Checking your explanation…" : "Check my explanation"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}

/* ---------- follow-up: practice using it (for a misapplication) ---------- */

function PracticeStep({ step, onAnswer, onNext }: Props) {
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);

  useEffect(() => {
    let live = true;
    postJson<PracticeQuestion[]>("/api/study/practice", { deckId: step.item.deckId, index: step.item.index, answer: step.context ?? "" })
      .then((q) => live && setQuestions(q))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [step.item.deckId, step.item.index, step.context]);

  const q = questions?.[at];
  const choices = useMemo(() => (q ? shuffle([q.back, ...q.wrong]) : []), [q]);

  const choose = (choice: string) => {
    if (picked || !q) return;
    setPicked(choice);
    const ok = choice === q.back;
    const total = right + (ok ? 1 : 0);
    if (ok) setRight(total);
    // After the last one, the follow-up counts as one answer
    if (questions && at + 1 === questions.length) onAnswer(total === questions.length ? "right" : total > 0 ? "almost" : "wrong");
  };
  const advance = () => {
    if (questions && at + 1 < questions.length) {
      setAt(at + 1);
      setPicked(null);
    } else onNext();
  };

  if (error || (questions && questions.length === 0)) {
    return (
      <div className={cn("grid gap-4 p-6 sm:p-8", CARD)}>
        <p className="text-muted-foreground">{error ?? "Couldn't make practice questions for this one."} It comes back later in the session instead.</p>
        <div className="flex justify-end">
          <Button onClick={onNext}>Next</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn("grid gap-6 p-6 sm:p-8", CARD)}>
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
          <span className="truncate">{step.item.card.topic || "Practice"}</span>
          <span className="shrink-0 rounded-full bg-foreground/5 px-2.5 py-1">{questions ? `Practice ${at + 1} of ${questions.length}` : "Practice"}</span>
        </div>
        {q ? (
          <p className="pb-2 text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl">{q.front}</p>
        ) : (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Spinner />
            Making two questions on that exact point…
          </p>
        )}
      </div>
      {q && (
        <div className="grid gap-2" role="group" aria-label="Choices">
          {choices.map((choice) => {
            const ok = choice === q.back;
            const state = !picked ? "idle" : ok ? "right" : choice === picked ? "wrong" : "idle";
            return (
              <Button
                key={choice}
                variant="outline"
                onClick={() => choose(choice)}
                aria-disabled={!!picked}
                className={cn(
                  "h-auto min-h-14 justify-start gap-3 rounded-2xl px-5 py-3.5 text-left text-base font-normal whitespace-normal transition-colors duration-150",
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
      )}
      {picked && <NextRow source={null} onNext={advance} />}
    </>
  );
}
