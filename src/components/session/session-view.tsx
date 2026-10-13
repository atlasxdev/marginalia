"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CoffeeIcon, PauseIcon, PlayIcon, XIcon } from "lucide-react";
import { addPetXp } from "@/app/actions/pet";
import { petQuery, spacesQuery, studyQuery } from "@/lib/queries";
import { deckInSubject, topicsIn } from "@/lib/subjects";
import type { AttemptResult, Deck, FocusMethod, Pet, Space, StudyOverview } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { useStudy, type StudyItem } from "@/lib/use-study";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PetSprite } from "../pet/pet-sprite";
import { BuddyPanel, type Reaction } from "./buddy-panel";
import { buildPlan, itemKey, topicPlan, type Step } from "./plan";
import { StepView } from "./step-view";

/* A study session, full screen: you, your buddy and one plan. The timer runs
   focus blocks over the cards; a break pauses the cards and recaps the block;
   cards you miss come back first in the next block; the end saves it all. */

const TIMERS: Record<FocusMethod, { label: string; detail: string; focus: number | null; rest: number }> = {
  pomodoro: { label: "Pomodoro", detail: "25 minutes, then a 5 minute break", focus: 25 * 60, rest: 5 * 60 },
  "52-17": { label: "Long focus", detail: "52 minutes, then a 17 minute break", focus: 52 * 60, rest: 17 * 60 },
  flow: { label: "No timer", detail: "Go through the cards at your own pace", focus: null, rest: 0 },
};

const RIGHT_LINES = ["Nice!", "You got it.", "That's the one.", "Easy for you."];
const ALMOST_LINES = ["So close. Look at what was missing.", "Almost. We'll come back to it."];
const MISS_LINES = ["We'll see it again soon.", "That one's tricky. It's coming back.", "No worries, it'll stick."];
const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

type Result = { step: Step; result: AttemptResult; block: number };

export function SessionView() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const study = useQuery(studyQuery);
  const spaces = useQuery(spacesQuery);
  const scope = { subject: params.get("subject") ?? undefined, deck: params.get("deck") ?? undefined, topic: params.get("topic") ?? undefined };

  if (!hydrated || !study.data || !spaces.data) {
    return (
      <div className="mx-auto grid max-w-xl gap-4 px-5 pt-24">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  }
  const space = spaces.data.find((s) => s.id === scope.subject);
  return <Session key={params.toString()} overview={study.data} space={space} scope={scope} />;
}

function Session({ overview, space, scope }: { overview: StudyOverview; space?: Space; scope: { subject?: string; deck?: string; topic?: string } }) {
  const queryClient = useQueryClient();
  const decks = useMemo<Deck[]>(() => {
    if (scope.deck) return overview.decks.filter((d) => d.id === scope.deck);
    if (space) return overview.decks.filter((d) => deckInSubject(d, space));
    return overview.decks;
  }, [overview.decks, scope.deck, space]);
  const study = useStudy(decks);
  const title = scope.topic ?? (scope.deck ? decks[0]?.payload.title : space?.name) ?? "All subjects";
  const backHref = space ? `/spaces/${space.id}` : "/study";

  // The plan is fixed when the session opens
  const [plan] = useState<Step[]>(() => {
    const items = study.items();
    if (scope.topic) {
      const topic = overview.weakTopics.find((t) => t.topic === scope.topic);
      const keys = new Set(topic?.cards.map((c) => `${c.deckId}:${c.index}`));
      const byName = (i: StudyItem) => (i.card.topic ?? "").trim().toLowerCase() === scope.topic!.trim().toLowerCase();
      return topicPlan(items.filter((i) => keys.has(itemKey(i)) || byName(i)));
    }
    const weakKeys = new Set(topicsIn(overview.weakTopics, decks).flatMap((t) => t.cards.map((c) => `${c.deckId}:${c.index}`)));
    return buildPlan(items, weakKeys);
  });

  const [phase, setPhase] = useState<"setup" | "focus" | "break" | "summary">("setup");
  const [method, setMethod] = useState<FocusMethod>("pomodoro");
  const [queue, setQueue] = useState<Step[]>(plan);
  const [stepSeq, setStepSeq] = useState(0);
  // The step whose answer is showing, so the count doesn't move on until you do
  const [answeredSeq, setAnsweredSeq] = useState(-1);
  const [results, setResults] = useState<Result[]>([]);
  const [block, setBlock] = useState(1);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  // Flip cards answer and move on in one tap, before the results state updates
  const lastAnswer = useRef<{ key: string; result: AttemptResult } | null>(null);
  const react = (face: Reaction["face"], line: string) => setReaction((r) => ({ face, line, seq: (r?.seq ?? 0) + 1 }));

  // Timer: focus time is counted from timestamps, so a backgrounded tab stays accurate
  const [now, setNow] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [breakEndsAt, setBreakEndsAt] = useState<number | null>(null);
  // Focus time banked so far, and when the running stretch started (0 while stopped)
  const [focus, setFocus] = useState({ ms: 0, since: 0 });
  const paused = pausedLeft !== null;
  const timer = TIMERS[method];

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  const closeSegment = useCallback(() => {
    setFocus((f) => (f.since ? { ms: f.ms + Date.now() - f.since, since: 0 } : f));
  }, []);

  const startBlock = () => {
    const at = Date.now();
    if (!startedAt) setStartedAt(new Date(at).toISOString());
    setFocus((f) => ({ ...f, since: at }));
    setEndsAt(timer.focus ? at + timer.focus * 1000 : null);
    setPausedLeft(null);
    setBreakEndsAt(null);
    setPhase("focus");
    react("side", block === 1 ? "Let's go. I'm right here." : "Back at it. The ones you missed come first.");
  };

  const finish = useCallback(() => {
    closeSegment();
    setPhase("summary");
  }, [closeSegment]);

  const takeBreak = useCallback(() => {
    closeSegment();
    // Cards missed this block come first next block
    setQueue((q) => [...q.filter((s) => s.reason === "again"), ...q.filter((s) => s.reason !== "again")]);
    setBreakEndsAt(Date.now() + timer.rest * 1000);
    setPhase("break");
  }, [closeSegment, timer.rest]);

  // The block ends when its time is up
  useEffect(() => {
    if (phase === "focus" && endsAt && !paused && now >= endsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the timer running out is an external event
      takeBreak();
    }
  }, [phase, endsAt, paused, now, takeBreak]);

  const pause = () => {
    closeSegment();
    setPausedLeft(endsAt ? endsAt - Date.now() : 0);
  };
  const resume = () => {
    setFocus((f) => ({ ...f, since: Date.now() }));
    if (endsAt && pausedLeft !== null) setEndsAt(Date.now() + pausedLeft);
    setPausedLeft(null);
  };

  const answer = (step: Step, result: AttemptResult) => {
    const knew = result === "right";
    study.rate(step.item, knew);
    // Typed answers are saved when they're checked
    if (step.mode !== "recall") study.saveAttempt({ deckId: step.item.deckId, index: step.item.index, result, mode: step.mode });
    lastAnswer.current = { key: step.key, result };
    setAnsweredSeq(stepSeq);
    setResults((r) => [...r, { step, result, block }]);
    react(knew ? "happy" : "flat", pick(knew ? RIGHT_LINES : result === "almost" ? ALMOST_LINES : MISS_LINES));
  };

  const next = () => {
    const [step, ...rest] = queue;
    const last = lastAnswer.current;
    // A miss comes back later in the session, as a flip card
    const again: Step[] = step && last?.key === step.key && last.result !== "right" ? [{ ...step, mode: "cards", reason: "again" }] : [];
    const updated = [...rest, ...again];
    setQueue(updated);
    setStepSeq((n) => n + 1);
    if (updated.length === 0) finish();
  };

  const current = queue[0];
  const focusLeft = endsAt ? (paused ? pausedLeft! : endsAt - now) / 1000 : null;
  const elapsed = (focus.ms + (focus.since ? Math.max(0, now - focus.since) : 0)) / 1000;
  const done = results.length - (answeredSeq === stepSeq ? 1 : 0);
  const total = done + queue.length;

  // Leaving mid-session still saves the focus time
  useEffect(() => {
    if (phase !== "focus" && phase !== "break") return;
    const save = () => {
      const seconds = Math.round((focus.ms + (focus.since ? Date.now() - focus.since : 0)) / 1000);
      if (seconds < 60 || !startedAt) return;
      navigator.sendBeacon(
        "/api/study/sessions",
        new Blob([JSON.stringify({ method, focusSeconds: Math.min(seconds, 14_400), startedAt, spaceId: space?.id })], { type: "application/json" })
      );
    };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [phase, method, startedAt, space?.id, focus]);

  if (phase === "setup") {
    return <Setup title={title} plan={plan} backHref={backHref} method={method} setMethod={setMethod} onStart={startBlock} />;
  }
  if (phase === "summary") {
    return (
      <Summary
        title={title}
        results={results}
        focusedSeconds={Math.round(focus.ms / 1000)}
        method={method}
        startedAt={startedAt}
        space={space}
        backHref={backHref}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["study"] })}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar: where you are, the timer, how far along */}
      <header className="glass sticky top-0 z-10 border-b border-glass-border bg-glass">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" onClick={finish} aria-label="End session" className="text-muted-foreground">
            <XIcon />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">
              {phase === "break" ? "Break" : timer.focus ? `${timer.label}, block ${block}` : "At your own pace"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-2xl font-semibold tracking-tight tabular-nums", paused && "text-muted-foreground")} aria-live="off">
              {phase === "break" ? clock(((breakEndsAt ?? now) - now) / 1000) : focusLeft !== null ? clock(focusLeft) : clock(elapsed)}
            </span>
            {phase === "focus" && (
              <Button variant="glass" size="icon" onClick={paused ? resume : pause} aria-label={paused ? "Resume" : "Pause"}>
                {paused ? <PlayIcon /> : <PauseIcon />}
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={finish} className="hidden sm:inline-flex">
            End session
          </Button>
        </div>
        <div className="h-1 bg-foreground/10" aria-hidden>
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </header>

      {/* The card sits in the middle of the screen; your buddy sits beside it on wide screens, below it on narrow ones */}
      <main className="grid w-full flex-1 grid-cols-[minmax(0,1fr)] content-start gap-6 px-4 py-8 sm:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,38rem)_minmax(0,1fr)] xl:content-center xl:items-center xl:gap-8 xl:py-12">
        <div className="mx-auto w-full max-w-2xl xl:col-start-2">
          {phase === "break" ? (
            <BreakRecap
              results={results.filter((r) => r.block === block)}
              upNext={queue}
              over={!!breakEndsAt && now >= breakEndsAt}
              onNext={() => {
                setBlock((b) => b + 1);
                startBlock();
              }}
              onEnd={finish}
            />
          ) : paused ? (
            <div className="grid justify-items-center gap-3 py-24 text-center">
              <p className="text-xl font-semibold">Paused</p>
              <p className="text-muted-foreground">The cards wait for you.</p>
              <Button size="lg" onClick={resume}>
                <PlayIcon />
                Resume
              </Button>
            </div>
          ) : current ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground tabular-nums">
                Card {done + 1} of {total}
              </p>
              <StepView key={`${current.key}-${stepSeq}`} step={current} onAnswer={(r) => answer(current, r)} onNext={next} />
              {timer.focus && (
                <div className="mt-8 flex justify-center">
                  <Button variant="ghost" size="sm" onClick={takeBreak} className="text-muted-foreground">
                    <CoffeeIcon />
                    Take a break now
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </div>
        <div className="mx-auto w-full max-w-2xl xl:col-start-3 xl:mx-0 xl:max-w-xs">
          <BuddyPanel reaction={reaction} step={phase === "focus" && !paused ? current : undefined} spaceId={space?.id} resting={phase === "break"} />
        </div>
      </main>
    </div>
  );
}

/* ---------- before: what's in the plan, and the timer ---------- */

function Setup({
  title,
  plan,
  backHref,
  method,
  setMethod,
  onStart,
}: {
  title: string;
  plan: Step[];
  backHref: string;
  method: FocusMethod;
  setMethod: (m: FocusMethod) => void;
  onStart: () => void;
}) {
  const pet = useQuery(petQuery).data;
  const count = (reason: Step["reason"]) => plan.filter((s) => s.reason === reason).length;
  const weakTopics = [...new Set(plan.filter((s) => s.reason === "weak").map((s) => s.item.card.topic).filter(Boolean))];
  const lines = [
    count("due") && `${count("due")} ${count("due") === 1 ? "card" : "cards"} to review`,
    count("weak") && `${count("weak")} on ${weakTopics.length ? weakTopics.slice(0, 2).join(" and ") : "weak topics"}, typed out`,
    count("new") && `${count("new")} new ${count("new") === 1 ? "card" : "cards"}`,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
      <Button variant="ghost" size="sm" asChild className="-ml-2.5 mb-8 self-start text-muted-foreground">
        <Link href={backHref}>
          <XIcon />
          Close
        </Link>
      </Button>
      <div className="flex items-center gap-4">
        {pet && (
          <span className="grid size-16 shrink-0 place-items-end justify-center overflow-hidden rounded-2xl bg-[#e7effc] pb-1.5 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
            <PetSprite look={pet} face="side" book className="h-[50px] w-12 animate-[pet-read_2.4s_ease-in-out_infinite] motion-reduce:animate-none" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight wrap-anywhere">{title}</h1>
          <p className="mt-1 text-muted-foreground">{pet ? `${pet.name} has a plan for this session.` : "Here's the plan for this session."}</p>
        </div>
      </div>

      {plan.length === 0 ? (
        <div className="mt-10 grid gap-3">
          <p className="text-lg font-medium">Nothing to study here yet.</p>
          <p className="text-muted-foreground">Make a reviewer from your notes first, then come back.</p>
          <Button asChild className="mt-2 self-start">
            <Link href={backHref}>Go back</Link>
          </Button>
        </div>
      ) : (
        <>
          <ol className="glass mt-8 grid gap-0 rounded-2xl border border-glass-border bg-glass">
            {lines.map((line, i) => (
              <li key={line} className={cn("flex items-center gap-3 px-5 py-3.5", i > 0 && "border-t border-glass-divider")}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                {line}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">Cards you miss come back before the session ends.</p>

          <p className="mt-8 text-sm font-medium">Timer</p>
          <ToggleGroup type="single" variant="outline" value={method} onValueChange={(v) => v && setMethod(v as FocusMethod)} className="mt-2 w-full">
            {(Object.keys(TIMERS) as FocusMethod[]).map((m) => (
              <ToggleGroupItem
                key={m}
                value={m}
                className="flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
              >
                {TIMERS[m].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="mt-2 text-sm text-muted-foreground">{TIMERS[method].detail}</p>

          <Button size="lg" className="mt-8 h-12 text-base" onClick={onStart}>
            <PlayIcon />
            Start session
          </Button>
        </>
      )}
    </div>
  );
}

/* ---------- a break: recap of the block, then the next one ---------- */

function BreakRecap({ results, upNext, over, onNext, onEnd }: { results: Result[]; upNext: Step[]; over: boolean; onNext: () => void; onEnd: () => void }) {
  const right = results.filter((r) => r.result === "right").length;
  const missed = [...new Map(results.filter((r) => r.result !== "right").map((r) => [r.step.key, r.step])).values()];
  return (
    <div className="grid gap-6 animate-in fade-in duration-300 motion-reduce:animate-none">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{over ? "Break's over" : "Take a break"}</h2>
        <p className="mt-1 text-muted-foreground">{over ? "Ready when you are." : "Stand up, stretch, drink some water. Look away from the screen."}</p>
      </div>
      <div className="glass grid grid-cols-2 rounded-2xl border border-glass-border bg-glass">
        <div className="px-5 py-4">
          <p className="text-xs text-muted-foreground">This block</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{results.length} cards</p>
        </div>
        <div className="border-l border-glass-divider px-5 py-4">
          <p className="text-xs text-muted-foreground">Right</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{results.length ? `${Math.round((right / results.length) * 100)}%` : "None yet"}</p>
        </div>
      </div>
      {missed.length > 0 && (
        <div>
          <p className="text-sm font-medium">Coming back first next block</p>
          <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
            {missed.slice(0, 5).map((s) => (
              <li key={s.key} className="truncate">
                {s.item.card.front}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {upNext.length > 0 && (
          <Button size="lg" onClick={onNext}>
            <PlayIcon />
            {over ? "Start the next block" : "Skip the break"}
          </Button>
        )}
        <Button size="lg" variant="outline" onClick={onEnd}>
          End session
        </Button>
      </div>
    </div>
  );
}

/* ---------- the end: what you did, saved ---------- */

function Summary({
  title,
  results,
  focusedSeconds,
  method,
  startedAt,
  space,
  backHref,
  onSaved,
}: {
  title: string;
  results: Result[];
  focusedSeconds: number;
  method: FocusMethod;
  startedAt: string | null;
  space?: Space;
  backHref: string;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const pet = useQuery(petQuery).data;
  const cards = new Set(results.map((r) => r.step.key)).size;
  const right = results.filter((r) => r.result === "right").length;
  const accuracy = results.length ? right / results.length : null;
  const minutes = Math.round(focusedSeconds / 60);
  const xp = Math.min(cards, 20) + Math.min(right, 20) + Math.min(Math.round(minutes / 2), 30);
  // Topics you missed, most-missed first
  const missedTopics = [
    ...results
      .filter((r) => r.result !== "right" && r.step.item.card.topic)
      .reduce((m, r) => m.set(r.step.item.card.topic!, (m.get(r.step.item.card.topic!) ?? 0) + 1), new Map<string, number>()),
  ]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  // Saved once: the focus time, and your buddy's XP
  const saved = useRef(false);
  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    const work: Promise<unknown>[] = [];
    if (focusedSeconds >= 60 && startedAt) {
      work.push(
        fetch("/api/study/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method, focusSeconds: Math.min(focusedSeconds, 14_400), startedAt, spaceId: space?.id }),
        })
      );
    }
    if (xp > 0 && queryClient.getQueryData(["pet"])) {
      queryClient.setQueryData<Pet | null>(["pet"], (p) => (p ? { ...p, xp: p.xp + xp } : p));
      for (let left = xp; left > 0; left -= 20) work.push(addPetXp(Math.min(left, 20)));
    }
    void Promise.all(work).finally(onSaved);
  }, [focusedSeconds, method, startedAt, space?.id, xp, queryClient, onSaved]);

  const good = accuracy !== null && accuracy >= 0.7;
  const headline = results.length === 0 ? "Session ended" : good ? "Great session" : "Good work showing up";
  const line =
    results.length === 0
      ? "Nothing answered this time. Come back when you're ready."
      : good
        ? `You knew most of it.${missedTopics[0] ? ` ${missedTopics[0]} is the one to watch.` : ""}`
        : `${missedTopics[0] ? `${missedTopics[0]} needs another go.` : "Those misses will come back soon."} That's how it sticks.`;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12 animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none">
      <div className="flex items-center gap-4">
        {pet && (
          <span className="grid size-16 shrink-0 place-items-end justify-center overflow-hidden rounded-2xl bg-[#e7effc] pb-1.5 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
            <PetSprite
              look={pet}
              face={good || results.length === 0 ? "happy" : "open"}
              className="h-[50px] w-12 origin-bottom animate-[pet-hop_400ms_ease-out] motion-reduce:animate-none"
            />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{headline}</h1>
          <p className="mt-1 text-muted-foreground">{title}</p>
        </div>
      </div>
      <p className="mt-6 text-lg">{line}</p>

      <dl className="glass mt-6 grid grid-cols-2 rounded-2xl border border-glass-border bg-glass sm:grid-cols-4">
        {[
          ["Cards", String(cards)],
          ["Right", accuracy === null ? "None" : `${Math.round(accuracy * 100)}%`],
          ["Focused", `${minutes} min`],
          ["XP", `+${xp}`],
        ].map(([label, value], i) => (
          <div key={label} className={cn("px-4 py-4", i > 0 && "border-glass-divider sm:border-l", i % 2 === 1 && "border-l", i >= 2 && "border-t sm:border-t-0")}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {missedTopics.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium">Work on next</p>
          <p className="mt-1 text-sm text-muted-foreground">{missedTopics.slice(0, 4).join(", ")}</p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        <Button size="lg" asChild>
          <Link href={backHref}>{space ? `Back to ${space.name}` : "Back to Today"}</Link>
        </Button>
        {space && (
          <Button size="lg" variant="outline" asChild>
            <Link href="/study">Today</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
