"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleDashedIcon, FlagIcon, PlayIcon, XIcon } from "lucide-react";
import { addPetXp, saveActionState, saveAttempts } from "@/lib/writes";
import { rate as schedule } from "@/lib/leitner";
import { makeClaim, makeSelectAll, pickedAllRight, shuffle, type Claim, type SelectAll } from "@/lib/questions";
import { meQuery, petQuery, spacesQuery, studyQuery } from "@/lib/queries";
import { decksIn, examSubjects, lastExamKey, useExams } from "@/lib/exams";
import { deckInSubject, sessionHref, type SessionScope } from "@/lib/subjects";
import type { AttemptResult, CardProgress, CheckResult, Deck, Pet } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { useStudy, type StudyItem } from "@/lib/use-study";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MusicButton } from "../music/music-button";
import { PetSprite } from "../pet/pet-sprite";

/* A practice exam: mixed questions from a whole subject, timed, with no hints
   until you hand it in. Then a score, how each topic went, and a session on
   the ones you missed. */

type Kind = "choice" | "typed" | "truefalse" | "multi";
type Question = { key: string; item: StudyItem; kind: Kind; choices: string[]; claim?: Claim; selectAll?: SelectAll };

const KIND_LABEL: Record<Kind, string> = { choice: "Choice", typed: "Typed", truefalse: "True or false", multi: "Select all" };
// A select-all answer is the picked options, kept in one string like the others
const SEP = "\u001f";
const pickedOf = (answer: string) => (answer ? answer.split(SEP) : []);
type Graded = { question: Question; answer: string; result: AttemptResult; feedback?: string };

const SECONDS_PER_QUESTION = 90;
const CARD = "rounded-[24px] border border-border/60 bg-card shadow-xl shadow-black/10 dark:shadow-black/30";

/* A mixed paper: a card with a select-all version is asked that way; the rest
   take turns, and a card that can't be asked one way is asked the next way it can. */
const ORDER: Kind[] = ["choice", "typed", "truefalse"];
function makeQuestion(item: StudyItem, i: number): Question {
  const key = `${item.deckId}:${item.index}`;
  const selectAll = makeSelectAll(item.card);
  if (selectAll) return { key, item, kind: "multi", choices: [], selectAll };
  for (let k = 0; k < ORDER.length; k++) {
    const kind = ORDER[(i + k) % ORDER.length];
    if (kind === "choice" && item.card.wrong.length >= 2) return { key, item, kind, choices: shuffle([item.card.back, ...item.card.wrong]) };
    if (kind === "truefalse") {
      const claim = makeClaim(item.card);
      if (claim) return { key, item, kind, choices: [], claim };
    }
    if (kind === "typed") return { key, item, kind, choices: [] };
  }
  return { key, item, kind: "typed", choices: [] };
}

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export { lastExamKey };

export function ExamView() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const study = useQuery(studyQuery);
  const spaces = useQuery(spacesQuery);
  const exams = useExams();
  const me = useQuery(meQuery);
  if (!hydrated || !study.data || !spaces.data || (params.get("exam") && !me.isSuccess)) {
    return (
      <div className="mx-auto grid max-w-xl gap-4 px-5 pt-24">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  }
  // A paper from one subject, or from every subject an exam covers
  const space = spaces.data.find((s) => s.id === params.get("subject"));
  const exam = exams.find((e) => e.id === params.get("exam"));
  const paper: Paper | null = space
    ? { id: space.id, name: space.name, href: `/spaces/${space.id}`, scope: { subject: space.id }, decks: study.data.decks.filter((d) => deckInSubject(d, space)) }
    : exam
      ? { id: exam.id, name: exam.name, href: `/exams/${exam.id}`, scope: { exam: exam.id }, decks: decksIn(study.data.decks, examSubjects(exam, spaces.data)) }
      : null;
  if (!paper) {
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 px-5 pt-32 text-center">
        <p className="text-xl font-semibold">Pick a subject first</p>
        <p className="text-muted-foreground">Practice exams are made from one subject&apos;s flashcards.</p>
        <Button asChild>
          <Link href="/study">Back to Today</Link>
        </Button>
      </div>
    );
  }
  return <Exam key={paper.id} paper={paper} />;
}

/** What a practice exam is made from, and where it leads back to. */
type Paper = { id: string; name: string; href: string; scope: SessionScope; decks: Deck[] };

function Exam({ paper }: { paper: Paper }) {
  const decks = paper.decks;
  const study = useStudy(decks);
  const [items] = useState(() => study.items());
  const [phase, setPhase] = useState<"setup" | "exam" | "grading" | "results">("setup");
  const [length, setLength] = useState(Math.min(10, items.length));
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [at, setAt] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [graded, setGraded] = useState<Graded[]>([]);
  const [usedSeconds, setUsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (phase !== "exam") return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [phase]);

  const start = () => {
    const picked = shuffle(items).slice(0, length);
    setQuestions(picked.map(makeQuestion));
    const t = Date.now();
    setStartedAt(t);
    setEndsAt(t + picked.length * SECONDS_PER_QUESTION * 1000);
    setAt(0);
    setPhase("exam");
  };

  const handIn = async () => {
    setUsedSeconds(Math.round((Date.now() - startedAt) / 1000));
    setPhase("grading");
    setError(null);
    try {
      const typed = questions.filter((q) => q.kind === "typed");
      const checks = new Map<string, CheckResult>();
      // The checker marks up to ten at a time, against your notes
      for (let i = 0; i < typed.length; i += 10) {
        const batch = typed.slice(i, i + 10);
        const res = await fetch("/api/study/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batch.map((q) => ({ deckId: q.item.deckId, index: q.item.index, answer: answers[q.key] ?? "" })) }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't mark your typed answers. Try again.");
        const results = (await res.json()) as CheckResult[];
        results.forEach((r, j) => checks.set(batch[j].key, r));
      }
      const marked: Graded[] = questions.map((q) => {
        const answer = answers[q.key] ?? "";
        if (q.kind === "choice") return { question: q, answer, result: answer === q.item.card.back ? "right" : "wrong" };
        if (q.kind === "truefalse") return { question: q, answer, result: answer && (answer === "True") === q.claim!.isTrue ? "right" : "wrong" };
        if (q.kind === "multi") return { question: q, answer, result: pickedAllRight(pickedOf(answer), q.selectAll!.right) ? "right" : "wrong" };
        const c = checks.get(q.key);
        return { question: q, answer, result: c?.result ?? "wrong", feedback: c?.feedback };
      });

      // Save it: the attempts that were picked, not typed (typed ones are saved when they're checked), and each card's schedule
      const choiceAttempts = marked
        .filter((g) => g.question.kind !== "typed")
        .map((g) => ({ deckId: g.question.item.deckId, index: g.question.item.index, topic: g.question.item.card.topic, result: g.result, mode: "quiz" as const }));
      const saves: Promise<unknown>[] = [];
      if (choiceAttempts.length) {
        saves.push(saveAttempts(choiceAttempts));
      }
      for (const deck of decks) {
        const mine = marked.filter((g) => g.question.item.deckId === deck.id);
        if (!mine.length) continue;
        const cards: Record<string, CardProgress> = { ...(deck.state.cards ?? {}) };
        for (const g of mine) cards[g.question.item.index] = schedule(cards[g.question.item.index], g.result === "right");
        saves.push(saveActionState(deck.id, { cards }));
      }
      const right = marked.filter((g) => g.result === "right").length;
      const xp = Math.min(20, right * 2);
      if (xp && queryClient.getQueryData(["pet"])) {
        queryClient.setQueryData<Pet | null>(["pet"], (p) => (p ? { ...p, xp: p.xp + xp } : p));
        saves.push(addPetXp(xp));
      }
      try {
        localStorage.setItem(lastExamKey(paper.id), JSON.stringify({ right, total: marked.length, at: new Date().toISOString() }));
      } catch {
        // The last score is a convenience; the attempts are saved either way
      }
      await Promise.all(saves);
      void queryClient.invalidateQueries({ queryKey: ["study"] });
      setGraded(marked);
      setPhase("results");
    } catch (e) {
      setError((e as Error).message);
      setPhase("exam");
    }
  };

  // Time's up: it's handed in for you
  const left = (endsAt - now) / 1000;
  const handedIn = useRef(false);
  useEffect(() => {
    if (phase === "exam" && endsAt && now >= endsAt && !handedIn.current) {
      handedIn.current = true;
      void handIn();
    }
    // handIn reads the latest answers when it runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, now, endsAt]);

  if (phase === "setup") return <Setup paper={paper} available={items.length} length={length} setLength={setLength} onStart={start} />;
  if (phase === "results") return <Results paper={paper} graded={graded} usedSeconds={usedSeconds} />;

  const q = questions[at];
  const answered = questions.filter((x) => (answers[x.key] ?? "").trim()).length;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 bg-background/60 backdrop-blur-xl">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Practice exam: {paper.name}</p>
            <p className="text-xs text-muted-foreground">No hints until you hand it in</p>
          </div>
          <p className="hidden text-sm text-muted-foreground tabular-nums sm:block">
            {answered} of {questions.length} answered
          </p>
          <div className="flex items-center justify-end gap-3">
            <MusicButton focused />
            <span className={cn("text-xl font-semibold tabular-nums", left < 60 && "text-destructive")}>{clock(left)}</span>
            <Button onClick={() => void handIn()} disabled={phase === "grading"}>
              {phase === "grading" ? <Spinner /> : null}
              {phase === "grading" ? "Marking…" : "Hand in"}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6 lg:items-center">
        <div className="w-full max-w-2xl">
          {phase === "grading" ? (
            <div className="grid justify-items-center gap-3 py-20 text-center">
              <Spinner className="size-6" />
              <p className="text-lg font-medium">Marking your exam against your notes…</p>
            </div>
          ) : q ? (
            <div key={q.key} className="grid gap-5 animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none">
              {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <div className={cn("grid gap-5 p-6 sm:p-8", CARD)}>
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>
                    Question {at + 1} of {questions.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFlagged((f) => {
                        const n = new Set(f);
                        if (!n.delete(q.key)) n.add(q.key);
                        return n;
                      })
                    }
                    className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors", flagged.has(q.key) ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "hover:bg-foreground/5")}
                  >
                    <FlagIcon className="size-3.5" />
                    {flagged.has(q.key) ? "Flagged" : "Flag for later"}
                  </button>
                </div>
                <p className="text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl">{q.selectAll?.question ?? q.item.card.front}</p>
                {q.claim && <p className="rounded-2xl bg-foreground/[0.04] px-5 py-4 text-lg">{q.claim.answer}</p>}
                {q.selectAll && <p className="-mt-2 text-sm text-muted-foreground">Select all that apply</p>}
              </div>

              {q.kind === "truefalse" ? (
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="True or false">
                  {["True", "False"].map((value) => {
                    const on = answers[q.key] === value;
                    return (
                      <Button
                        key={value}
                        variant="outline"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setAnswers((a) => ({ ...a, [q.key]: value }))}
                        className={cn("h-14 rounded-2xl text-base", on && "border-primary bg-primary/10 text-foreground dark:border-primary dark:bg-primary/10")}
                      >
                        {value}
                      </Button>
                    );
                  })}
                </div>
              ) : q.kind === "multi" ? (
                <div className="grid gap-2" role="group" aria-label="Options">
                  {q.selectAll!.options.map((option) => {
                    const picked = pickedOf(answers[q.key] ?? "");
                    const on = picked.includes(option);
                    return (
                      <Button
                        key={option}
                        variant="outline"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() =>
                          setAnswers((a) => ({ ...a, [q.key]: (on ? picked.filter((o) => o !== option) : [...picked, option]).join(SEP) }))
                        }
                        className={cn(
                          "h-auto min-h-14 justify-start gap-3 rounded-2xl px-5 py-3.5 text-left text-base font-normal whitespace-normal",
                          on && "border-primary bg-primary/10 text-foreground dark:border-primary dark:bg-primary/10"
                        )}
                      >
                        <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                          {on && <CheckIcon className="size-3.5" />}
                        </span>
                        <span className="flex-1">{option}</span>
                      </Button>
                    );
                  })}
                </div>
              ) : q.kind === "choice" ? (
                <div className="grid gap-2" role="radiogroup" aria-label="Choices">
                  {q.choices.map((choice) => {
                    const on = answers[q.key] === choice;
                    return (
                      <Button
                        key={choice}
                        variant="outline"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setAnswers((a) => ({ ...a, [q.key]: choice }))}
                        className={cn(
                          "h-auto min-h-14 justify-start gap-3 rounded-2xl px-5 py-3.5 text-left text-base font-normal whitespace-normal",
                          on && "border-primary bg-primary/10 text-foreground dark:border-primary dark:bg-primary/10"
                        )}
                      >
                        <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", on ? "border-primary bg-primary" : "border-input")}>
                          {on && <span className="size-2 rounded-full bg-primary-foreground" />}
                        </span>
                        <span className="flex-1">{choice}</span>
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <Textarea
                  value={answers[q.key] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                  aria-label="Your answer"
                  placeholder="Your answer, in your own words"
                  autoFocus
                  className="min-h-28 rounded-2xl p-4 text-base"
                />
              )}

              <div className="flex items-center justify-between gap-3">
                <Button variant="glass" disabled={at === 0} onClick={() => setAt(at - 1)}>
                  <ChevronLeftIcon />
                  Back
                </Button>
                {at + 1 < questions.length ? (
                  <Button onClick={() => setAt(at + 1)}>
                    Next
                    <ChevronRightIcon />
                  </Button>
                ) : (
                  <Button onClick={() => void handIn()}>Hand in</Button>
                )}
              </div>

              {/* Jump to any question: filled when answered, amber when flagged */}
              <div className="flex flex-wrap justify-center gap-1.5 pt-2" aria-label="Questions">
                {questions.map((x, i) => (
                  <button
                    key={x.key}
                    type="button"
                    onClick={() => setAt(i)}
                    aria-label={`Question ${i + 1}${flagged.has(x.key) ? ", flagged" : ""}${(answers[x.key] ?? "").trim() ? ", answered" : ""}`}
                    className={cn(
                      "grid size-8 place-items-center rounded-lg text-xs font-medium tabular-nums transition-colors",
                      (answers[x.key] ?? "").trim() ? "bg-primary/15 text-primary" : "bg-foreground/5 text-muted-foreground",
                      flagged.has(x.key) && "ring-2 ring-amber-500",
                      i === at && "outline-2 outline-offset-2 outline-primary"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Setup({ paper, available, length, setLength, onStart }: { paper: Paper; available: number; length: number; setLength: (n: number) => void; onStart: () => void }) {
  const pet = useQuery(petQuery).data;
  const options = [10, 20, 30].filter((n) => n <= available);
  const lengths = options.length ? options : [available];
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="p-4 sm:p-6">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link href={paper.href}>
            <XIcon />
            Close
          </Link>
        </Button>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 pb-16 text-center">
        {pet && (
          <span className="grid h-32 w-36 place-items-end justify-center overflow-hidden rounded-[28px] bg-[#e7effc] pb-4 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
            <PetSprite look={pet} face="open" className="h-20 w-[75px]" />
          </span>
        )}
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-balance">Practice exam: {paper.name}</h1>
        {available < 3 ? (
          <>
            <p className="mt-2 text-muted-foreground">There aren&apos;t enough flashcards here yet. Add more notes and come back.</p>
            <Button asChild size="lg" className="mt-8">
              <Link href={paper.href}>Go back</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-muted-foreground text-balance">
              Mixed questions from across {paper.name}: multiple choice, true or false, select all that apply, and typed. It&apos;s timed, with no hints until you hand it in, like the real thing.
            </p>
            <p className="mt-10 text-sm font-medium">Questions</p>
            <ToggleGroup type="single" value={String(length)} onValueChange={(v) => v && setLength(Number(v))} className="mt-2 grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${lengths.length}, minmax(0, 1fr))` }} spacing={2}>
              {lengths.map((n) => (
                <ToggleGroupItem
                  key={n}
                  value={String(n)}
                  className="glass h-auto flex-col gap-1 rounded-2xl border border-glass-border bg-glass py-3 data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                >
                  <span className="text-lg font-semibold">{n}</span>
                  <span className="text-xs font-normal text-muted-foreground">{Math.round((n * SECONDS_PER_QUESTION) / 60)} min</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button size="lg" className="mt-8 h-12 w-full rounded-xl text-base" onClick={onStart}>
              <PlayIcon />
              Start the exam
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Results({ paper, graded, usedSeconds }: { paper: Paper; graded: Graded[]; usedSeconds: number }) {
  const pet = useQuery(petQuery).data;
  const right = graded.filter((g) => g.result === "right").length;
  const score = graded.length ? right / graded.length : 0;
  const missed = graded.filter((g) => g.result !== "right");
  // How each topic went, weakest first
  const topics = [
    ...graded
      .reduce((m, g) => {
        const t = g.question.item.card.topic || "Other";
        const cur = m.get(t) ?? { right: 0, total: 0 };
        m.set(t, { right: cur.right + (g.result === "right" ? 1 : 0), total: cur.total + 1 });
        return m;
      }, new Map<string, { right: number; total: number }>())
      .entries(),
  ].sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total);
  const good = score >= 0.7;
  const review = missed.map((g) => g.question.key).join(",");

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-14 animate-in fade-in duration-300 motion-reduce:animate-none">
      <div className="flex flex-col items-center text-center">
        {pet && (
          <span className="grid h-28 w-32 place-items-end justify-center overflow-hidden rounded-[26px] bg-[#e7effc] pb-3.5 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
            <PetSprite look={pet} face={good ? "happy" : "open"} className="h-[70px] w-[66px] origin-bottom animate-[pet-hop_500ms_ease-out] motion-reduce:animate-none" />
          </span>
        )}
        <p className="mt-6 text-sm text-muted-foreground">Practice exam: {paper.name}</p>
        <h1 className="mt-1 text-5xl font-bold tracking-tight tabular-nums">{Math.round(score * 100)}%</h1>
        <p className="mt-2 text-lg">
          {right} of {graded.length} right in {clock(usedSeconds)}. {good ? "You're in good shape." : "Now you know what to work on."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {missed.length > 0 && (
            <Button size="lg" asChild>
              <Link href={sessionHref({ ...paper.scope, cards: review })}>
                <PlayIcon />
                Study the {missed.length} you missed
              </Link>
            </Button>
          )}
          <Button size="lg" variant="glass" asChild>
            <Link href={paper.href}>Back to {paper.name}</Link>
          </Button>
        </div>
      </div>

      <section aria-labelledby="by-topic" className="mt-12">
        <h2 id="by-topic" className="text-lg font-semibold">
          By topic
        </h2>
        <div className="glass mt-3 grid gap-3 rounded-2xl border border-glass-border bg-glass p-5">
          {topics.map(([topic, t]) => (
            <div key={topic} className="grid gap-1.5">
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate font-medium">{topic}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {t.right} of {t.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div className={cn("h-full rounded-full", t.right / t.total >= 0.7 ? "bg-success" : t.right / t.total >= 0.4 ? "bg-amber-500" : "bg-destructive")} style={{ width: `${Math.max(4, (t.right / t.total) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="answers" className="mt-12">
        <h2 id="answers" className="text-lg font-semibold">
          Your answers
        </h2>
        <div className="mt-3 grid gap-3">
          {graded.map((g, i) => (
            <div key={g.question.key} className="glass grid gap-2 rounded-2xl border border-glass-border bg-glass p-5">
              <div className="flex items-start gap-3">
                {g.result === "right" ? (
                  <CheckIcon aria-label="Right" className="mt-0.5 size-5 shrink-0 text-success" />
                ) : g.result === "almost" ? (
                  <CircleDashedIcon aria-label="Almost" className="mt-0.5 size-5 shrink-0 text-amber-500" />
                ) : (
                  <XIcon aria-label="Wrong" className="mt-0.5 size-5 shrink-0 text-destructive" />
                )}
                <div className="grid min-w-0 gap-1">
                  <p className="font-medium">
                    {i + 1}. {g.question.selectAll?.question ?? g.question.item.card.front}
                  </p>
                  {g.question.claim && <p className="text-sm">&ldquo;{g.question.claim.answer}&rdquo;</p>}
                  <p className="text-sm text-muted-foreground">You: {pickedOf(g.answer.trim()).join(", ") || "No answer"}</p>
                  {g.result !== "right" && (
                    <p className="text-sm">
                      {g.question.claim
                        ? g.question.claim.isTrue
                          ? "It's true."
                          : `It's false. Answer: ${g.question.item.card.back}`
                        : `Answer: ${g.question.selectAll ? g.question.selectAll.right.join(", ") : g.question.item.card.back}`}
                    </p>
                  )}
                  {g.feedback && g.result !== "right" && <p className="text-sm text-muted-foreground">{g.feedback}</p>}
                </div>
                <Badge variant="outline" className="ml-auto shrink-0 rounded-full font-normal">
                  {KIND_LABEL[g.question.kind]}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
