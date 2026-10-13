"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, CircleDashedIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { isDue } from "@/lib/leitner";
import { petSignal } from "@/lib/pet-events";
import { petQuery } from "@/lib/queries";
import type { AttemptResult, CheckResult, FlashcardsAction, Source, StudyMode } from "@/lib/types";
import { useStudy, type AttemptInput, type StudyItem } from "@/lib/use-study";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PetSprite, type Face } from "./pet/pet-sprite";

type StudyProps = {
  mode: StudyMode | null;
  onClose: () => void;
  title: string;
  items: StudyItem[];
  onRate: (item: StudyItem, knew: boolean) => void;
  /** Called once when the session closes, with what to save. */
  onFinish: (attempts: AttemptInput[]) => void;
};

const SESSION_CARDS = 10;
const DESCRIPTIONS: Record<StudyMode, string> = {
  cards: "Answer in your head, then flip the card.",
  quiz: "Pick the right answer.",
  recall: "Type each answer in your own words. Your buddy checks them against your notes.",
};

/** Studying with your buddy: flip cards, a multiple-choice quiz, or typed answers it checks. */
export function StudyDialog({ mode, onClose, title, items, onRate, onFinish }: StudyProps) {
  // "Review the ones you missed" switches to flipping just those
  const [review, setReview] = useState<StudyItem[] | null>(null);
  const attempts = useRef<AttemptInput[]>([]);
  const [buddy, setBuddy] = useState<{ face: Face; line: string; seq: number } | null>(null);

  const react = (face: Face, line: string) => setBuddy((b) => ({ face, line, seq: (b?.seq ?? 0) + 1 }));

  const close = () => {
    const done = attempts.current;
    attempts.current = [];
    setReview(null);
    setBuddy(null);
    if (done.length) {
      petSignal({ kind: "studied", count: done.length, right: done.filter((a) => a.result === "right").length });
    }
    onFinish(done);
    onClose();
  };

  const record = (item: StudyItem, result: AttemptResult, kind: "cards" | "quiz") =>
    attempts.current.push({ deckId: item.deckId, index: item.index, result, mode: kind });

  const active: StudyMode | null = review ? "cards" : mode;
  const shared = { onRate, record, react, onClose: close };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="gap-6 sm:max-w-lg"
        // Focus the dialog itself, so the first card or choice doesn't open looking picked
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogHeader className="flex-row items-center gap-3 space-y-0 text-left">
          <Buddy face={buddy?.face} seq={buddy?.seq ?? 0} />
          <div className="grid min-w-0 flex-1 gap-1">
            <DialogTitle className="truncate">{review ? "The ones you missed" : title}</DialogTitle>
            <DialogDescription key={buddy?.seq} className="animate-in fade-in duration-150 motion-reduce:animate-none">
              {buddy?.line ?? (active ? DESCRIPTIONS[active] : "")}
            </DialogDescription>
          </div>
        </DialogHeader>
        {/* Keyed so each opening, and each review, starts a fresh session */}
        {active === "cards" && <CardSession key={review ? "review" : "cards"} items={review ?? items} {...shared} />}
        {active === "quiz" && <QuizSession key="quiz" items={items} {...shared} />}
        {active === "recall" && <RecallSession key="recall" items={items} {...shared} onReviewMissed={setReview} />}
      </DialogContent>
    </Dialog>
  );
}

/** Your pet, studying with you: it reads along, hops when you're right and squashes when you miss. */
function Buddy({ face, seq }: { face?: Face; seq: number }) {
  const pet = useQuery(petQuery).data;
  if (!pet) return null;
  return (
    <span className="grid size-12 shrink-0 place-items-end justify-center overflow-hidden rounded-xl bg-[#e7effc] pb-1 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
      <PetSprite
        // Keyed by each reaction, so the same reaction twice plays again
        key={seq}
        look={pet}
        face={face ?? "side"}
        book={!face || face === "side"}
        className={cn(
          "h-[38px] w-9 origin-bottom",
          face === "happy" && "animate-[pet-hop_400ms_ease-out] motion-reduce:animate-none",
          face === "flat" && "animate-[pet-squash_400ms_ease-out] motion-reduce:animate-none"
        )}
      />
    </span>
  );
}

type SessionProps = {
  items: StudyItem[];
  onRate: (item: StudyItem, knew: boolean) => void;
  record: (item: StudyItem, result: AttemptResult, kind: "cards" | "quiz") => void;
  react: (face: Face, line: string) => void;
  onClose: () => void;
};

// Due cards first, or everything if nothing's due, up to a session's worth
function sessionCards(items: StudyItem[]) {
  const due = items.filter((i) => isDue(i.progress));
  return (due.length ? due : items).slice(0, SESSION_CARDS);
}

const RIGHT_LINES = ["Nice!", "You got it.", "That's the one.", "Easy for you."];
const MISS_LINES = ["We'll see it again soon.", "Almost. We'll come back to it.", "That one's tricky."];
const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

function CardSession({ items, onRate, record, react, onClose }: SessionProps) {
  const [queue, setQueue] = useState(() => sessionCards(items));
  const [total] = useState(queue.length);
  const [flipped, setFlipped] = useState(false);
  const [gotIt, setGotIt] = useState(0);
  const item = queue[0];

  const answer = (knew: boolean) => {
    if (!item) return;
    onRate(item, knew);
    record(item, knew ? "right" : "wrong", "cards");
    react(knew ? "happy" : "flat", pick(knew ? RIGHT_LINES : MISS_LINES));
    setFlipped(false);
    // A missed card comes back at the end of this session
    setQueue((q) => (knew ? q.slice(1) : [...q.slice(1), item]));
    if (knew) setGotIt((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!item) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && e.key === "1") answer(false);
      else if (flipped && e.key === "2") answer(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!item) {
    return (
      <Finished
        line={`You got all ${total} ${total === 1 ? "card" : "cards"}.`}
        note="Cards you know come back later, right before you'd forget them."
        onClose={onClose}
      />
    );
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
          <Face label={item.card.topic || "Question"}>{item.card.front}</Face>
          <Face label="Answer" back source={item.source}>
            {item.card.back}
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
      <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      <p className="my-auto py-4 text-center text-lg leading-snug font-medium text-balance">{children}</p>
      {source && <span className="truncate text-xs text-muted-foreground">From {source}</span>}
    </div>
  );
}

function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function QuizSession({ items, onRate, record, react, onClose }: SessionProps) {
  // Cards without wrong answers can't be asked as multiple choice
  const questions = useMemo(
    () =>
      shuffle(items.filter((i) => i.card.wrong.length > 0))
        .slice(0, SESSION_CARDS)
        .map((item) => ({ item, choices: shuffle([item.card.back, ...item.card.wrong]) })),
    [items]
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
        note={score === questions.length ? "A perfect score." : "The ones you missed come back sooner in your reviews."}
        onClose={onClose}
      />
    );
  }

  const choose = (choice: string) => {
    if (picked) return;
    const right = choice === q.item.card.back;
    setPicked(choice);
    onRate(q.item, right);
    record(q.item, right ? "right" : "wrong", "quiz");
    react(right ? "happy" : "flat", pick(right ? RIGHT_LINES : MISS_LINES));
    if (right) setScore((s) => s + 1);
  };

  return (
    <div className="grid gap-5">
      <Progress value={step} max={questions.length} label={`Question ${step + 1} of ${questions.length}`} />
      <p className="text-lg leading-snug font-medium text-balance">{q.item.card.front}</p>
      <div className="grid gap-2" role="group" aria-label="Choices">
        {q.choices.map((choice) => {
          const right = choice === q.item.card.back;
          const state = !picked ? "idle" : right ? "right" : choice === picked ? "wrong" : "idle";
          return (
            <Button
              key={choice}
              variant="outline"
              onClick={() => choose(choice)}
              aria-disabled={!!picked}
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
          <p className="min-w-0 truncate text-xs text-muted-foreground">{q.item.source && `From ${q.item.source}`}</p>
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

async function requestCheck(items: { deckId: string; index: number; answer: string }[]): Promise<CheckResult[]> {
  const res = await fetch("/api/study/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't check your answers. Try again.");
  return res.json();
}

/* Typed answers: you answer each card in your own words, then your buddy checks
   them all at once against your notes, with feedback on each. */
function RecallSession({ items, onRate, react, onClose, onReviewMissed }: SessionProps & { onReviewMissed: (missed: StudyItem[]) => void }) {
  const [cards] = useState(() => sessionCards(items));
  const [answers, setAnswers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const step = answers.length;
  const item = cards[step];

  const submit = async (all: string[]) => {
    setChecking(true);
    setError(null);
    react("side", "Checking your answers against your notes…");
    try {
      const checked = await requestCheck(cards.map((c, i) => ({ deckId: c.deckId, index: c.index, answer: all[i] ?? "" })));
      checked.forEach((r, i) => cards[i] && onRate(cards[i], r.result === "right"));
      const right = checked.filter((r) => r.result === "right").length;
      petSignal({ kind: "studied", count: checked.length, right });
      react(
        right / checked.length >= 0.7 ? "happy" : "flat",
        right === checked.length ? "Perfect. You really know this." : "Here's how you did."
      );
      setResults(checked);
    } catch (e) {
      setError((e as Error).message);
      react("flat", "Something went wrong while checking.");
    } finally {
      setChecking(false);
    }
  };

  const next = (answer: string) => {
    const all = [...answers, answer];
    setAnswers(all);
    setDraft("");
    if (all.length === cards.length) void submit(all);
  };

  if (cards.length === 0) return <Finished line="This deck has no cards." note="Make a new reviewer to study." onClose={onClose} />;

  if (results) {
    const right = results.filter((r) => r.result === "right").length;
    const missed = cards.filter((_, i) => results[i]?.result !== "right");
    // How each topic went in this session, weakest first
    const topics = new Map<string, { score: number; total: number }>();
    results.forEach((r, i) => {
      const topic = cards[i]?.card.topic;
      if (!topic) return;
      const t = topics.get(topic) ?? { score: 0, total: 0 };
      topics.set(topic, { score: t.score + (r.result === "right" ? 1 : r.result === "almost" ? 0.5 : 0), total: t.total + 1 });
    });
    const weakest = [...topics.entries()].sort((a, b) => a[1].score / a[1].total - b[1].score / b[1].total)[0];

    return (
      <div className="grid max-h-[60dvh] gap-5 overflow-y-auto pr-1">
        <div className="grid gap-1">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {right} of {results.length} right
          </p>
          {weakest && weakest[1].score < weakest[1].total && (
            <p className="text-sm text-muted-foreground">Go over {weakest[0]} again next.</p>
          )}
        </div>
        <ul className="grid gap-3">
          {results.map((r, i) => {
            const card = cards[i];
            if (!card) return null;
            return (
              <li key={i} className="grid gap-1.5 rounded-xl border border-border p-4">
                <div className="flex items-start gap-2">
                  <Verdict result={r.result} />
                  <p className="leading-snug font-medium">{card.card.front}</p>
                </div>
                <p className="pl-7 text-sm text-muted-foreground">
                  You: {answers[i]?.trim() ? answers[i] : <span className="italic">no answer</span>}
                </p>
                <p className="pl-7 text-sm">{r.feedback}</p>
                {card.source && <p className="truncate pl-7 text-xs text-muted-foreground">From {card.source}</p>}
              </li>
            );
          })}
        </ul>
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 bg-popover pt-2">
          {missed.length > 0 && (
            <Button variant="outline" onClick={() => onReviewMissed(missed)}>
              Review the {missed.length} you missed
            </Button>
          )}
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  if (checking || error || !item) {
    return (
      <div className="grid justify-items-center gap-3 py-10 text-center">
        {error ? (
          <>
            <p className="text-destructive">{error}</p>
            <Button onClick={() => submit(answers)}>Try again</Button>
          </>
        ) : (
          <>
            <Spinner className="size-6" />
            <p className="text-muted-foreground">Checking {cards.length} answers…</p>
          </>
        )}
      </div>
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        next(draft);
      }}
    >
      <Progress value={step} max={cards.length} label={`Question ${step + 1} of ${cards.length}`} />
      <div className="grid gap-1">
        {item.card.topic && <span className="text-xs font-medium text-muted-foreground">{item.card.topic}</span>}
        <p className="text-lg leading-snug font-medium text-balance">{item.card.front}</p>
      </div>
      <Input
        key={step}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Your answer"
        aria-label="Your answer"
        maxLength={1000}
        className="h-12 text-base"
      />
      <div className="flex justify-between gap-3">
        <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => next("")}>
          I don&apos;t know
        </Button>
        <Button type="submit" disabled={!draft.trim()}>
          {step + 1 === cards.length ? "Check answers" : "Next"}
        </Button>
      </div>
    </form>
  );
}

function Verdict({ result }: { result: AttemptResult }) {
  if (result === "right") return <CheckIcon aria-label="Right" className="mt-0.5 size-5 shrink-0 text-success" />;
  if (result === "almost") return <CircleDashedIcon aria-label="Almost" className="mt-0.5 size-5 shrink-0 text-amber-500" />;
  return <XIcon aria-label="Wrong" className="mt-0.5 size-5 shrink-0 text-destructive" />;
}

function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="grid gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label={label} className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
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

/* Starts study sessions over a set of decks, from anywhere: a deck in a chat,
   all your due cards, or the cards for one weak topic. Render `dialog` once. */
export function useStudySession(decks: FlashcardsAction[], fallbackSources?: Source[]) {
  const study = useStudy(decks, fallbackSources);
  const [session, setSession] = useState<{ mode: StudyMode; title: string; items: StudyItem[] } | null>(null);

  const start = (mode: StudyMode, title: string, filter?: (item: StudyItem) => boolean) =>
    setSession({ mode, title, items: study.items(filter) });

  const dialog = (
    <StudyDialog
      mode={session?.mode ?? null}
      title={session?.title ?? ""}
      items={session?.items ?? []}
      onRate={study.rate}
      onFinish={(attempts) => void study.finish(attempts)}
      onClose={() => setSession(null)}
    />
  );
  return { ...study, start, dialog, studying: session !== null };
}
