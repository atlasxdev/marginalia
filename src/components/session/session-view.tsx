"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CoffeeIcon, HourglassIcon, InfinityIcon, MessageCircleQuestionIcon, PauseIcon, PlayIcon, TimerIcon, XIcon } from "lucide-react";
import { addPetXp } from "@/app/actions/pet";
import { petQuery, spacesQuery, studyQuery } from "@/lib/queries";
import { deckInSubject, topicsIn } from "@/lib/subjects";
import type { AttemptResult, Deck, FocusMethod, MissKind, Pet, Space, StudyOverview } from "@/lib/types";
import { useDailyGoal } from "@/lib/daily-goal";
import { playPetSound } from "@/lib/pet-sounds";
import { readTimer, saveTimer } from "@/lib/timer-pref";
import { useHydrated } from "@/lib/use-hydrated";
import { useStudy, type StudyItem } from "@/lib/use-study";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PetSprite } from "../pet/pet-sprite";
import type { Face } from "../pet/pet-sprite";
import { AskSheet } from "./ask-sheet";
import { useMusic } from "@/lib/music";
import { MusicButton } from "../music/music-button";
import { buildPlan, itemKey, topicPlan, type Step } from "./plan";
import { StepView } from "./step-view";

/* A study session, full screen: you, your buddy and one plan. The timer runs
   focus blocks over the cards; a break pauses the cards and recaps the block;
   cards you miss come back first in the next block; the end saves it all. */

const TIMERS: Record<FocusMethod, { label: string; short: string; focus: number | null; rest: number }> = {
  pomodoro: { label: "Pomodoro", short: "25 min, 5 break", focus: 25 * 60, rest: 5 * 60 },
  "52-17": { label: "Long focus", short: "52 min, 17 break", focus: 52 * 60, rest: 17 * 60 },
  flow: { label: "No timer", short: "Your own pace", focus: null, rest: 0 },
};

/** How your buddy reacts to an answer. A miss comes with an offer to explain that card. */
type Reaction = { face: Face; line: string; seq: number; explain?: Step };

const RIGHT_LINES = ["Nice!", "You got it.", "That's the one."];
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
  const scope = {
    subject: params.get("subject") ?? undefined,
    deck: params.get("deck") ?? undefined,
    topic: params.get("topic") ?? undefined,
    cards: params.get("cards") ?? undefined,
  };

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

function Session({ overview, space, scope }: { overview: StudyOverview; space?: Space; scope: { subject?: string; deck?: string; topic?: string; cards?: string } }) {
  const queryClient = useQueryClient();
  const decks = useMemo<Deck[]>(() => {
    if (scope.deck) return overview.decks.filter((d) => d.id === scope.deck);
    if (space) return overview.decks.filter((d) => deckInSubject(d, space));
    return overview.decks;
  }, [overview.decks, scope.deck, space]);
  const study = useStudy(decks);
  const title = scope.cards ? `${space?.name ?? "Exam"}: the ones you missed` : (scope.topic ?? (scope.deck ? decks[0]?.payload.title : space?.name) ?? "All subjects");
  const backHref = space ? `/spaces/${space.id}` : "/study";

  // The plan is fixed when the session opens
  const [plan] = useState<Step[]>(() => {
    const items = study.items();
    if (scope.cards) {
      const keys = new Set(scope.cards.split(","));
      return topicPlan(items.filter((i) => keys.has(itemKey(i))));
    }
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
  const [method, setMethod] = useState<FocusMethod>(readTimer);
  const [queue, setQueue] = useState<Step[]>(plan);
  const [stepSeq, setStepSeq] = useState(0);
  // The step whose answer is showing, so the count doesn't move on until you do
  const [answeredSeq, setAnsweredSeq] = useState(-1);
  const [results, setResults] = useState<Result[]>([]);
  const [block, setBlock] = useState(1);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  // "Ask" opens on the card you're on, or on one you just missed, with a first question already asked
  // The app's music plays on through the session; it can pause for breaks and at the end
  const music = useMusic();
  const [asking, setAsking] = useState<{ step: Step; question?: string } | null>(null);
  const pet = useQuery(petQuery).data;
  // Flip cards answer and move on in one tap, before the results state updates
  const lastAnswer = useRef<{ key: string; result: AttemptResult; miss?: MissKind; typed?: string } | null>(null);
  const react = (face: Reaction["face"], line: string, explain?: Step) => {
    setReaction((r) => ({ face, line, explain, seq: (r?.seq ?? 0) + 1 }));
    if (pet) playPetSound(face === "happy" ? "pet" : face === "flat" ? "shrug" : "hi", pet.species);
  };

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
  // Without a timer, a break you take yourself is 5 minutes
  const restSeconds = timer.rest || 5 * 60;

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
    if (music.stopOnBreak) music.pause();
  }, [closeSegment, music]);

  const takeBreak = useCallback(() => {
    closeSegment();
    // Cards missed this block come first next block
    setQueue((q) => [...q.filter((s) => s.reason === "again"), ...q.filter((s) => s.reason !== "again")]);
    setBreakEndsAt(Date.now() + restSeconds * 1000);
    setPhase("break");
    if (music.stopOnBreak) music.pause();
    if (pet) playPetSound("notes", pet.species);
  }, [closeSegment, restSeconds, pet, music]);

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

  const answer = (step: Step, result: AttemptResult, detail?: { miss?: MissKind; typed?: string }) => {
    const knew = result === "right";
    // Follow-ups don't move a card's schedule; the card already counted
    if (step.reason !== "followup") {
      study.rate(step.item, knew);
      // Typed answers are saved when they're checked
      if (step.mode === "cards" || step.mode === "quiz") study.saveAttempt({ deckId: step.item.deckId, index: step.item.index, result, mode: step.mode });
    }
    lastAnswer.current = { key: step.key, result, miss: detail?.miss, typed: detail?.typed };
    setAnsweredSeq(stepSeq);
    setResults((r) => [...r, { step, result, block }]);
    if (knew) react("happy", step.reason === "followup" ? "Now you've got it." : pick(RIGHT_LINES));
    else if (detail?.miss === "misunderstood") react("flat", "That one's mixed up. Let's untangle it.");
    else if (detail?.miss === "misapplied") react("flat", "You know it. Let's practise using it.");
    else if (step.reason === "followup") react("flat", "Getting there. It comes back later.");
    else react("flat", result === "almost" ? "Almost. Want me to explain it?" : "Not quite. Want me to explain it?", step);
  };

  const next = () => {
    const [step, ...rest] = queue;
    const last = step && lastAnswer.current?.key === step.key ? lastAnswer.current : null;
    const missed = !!last && last.result !== "right" && step.reason !== "followup";
    // A miss comes back later in the session, as a flip card
    const again: Step[] = missed ? [{ ...step, key: `${step.key}:again`, mode: "cards", reason: "again" }] : [];
    // Why it missed decides what comes straight after: explain it back, or practise using it
    const follow: Step[] =
      missed && last?.miss === "misunderstood"
        ? [{ ...step, key: `${step.key}:teach`, mode: "teach", reason: "followup" }]
        : missed && last?.miss === "misapplied"
          ? [{ ...step, key: `${step.key}:practice`, mode: "practice", reason: "followup", context: last.typed }]
          : [];
    const updated = [...follow, ...rest, ...again];
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
    return <Setup title={title} plan={plan} backHref={backHref} method={method} setMethod={(m) => (setMethod(m), saveTimer(m))} onStart={startBlock} />;
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

  const timeLeft = phase === "break" ? ((breakEndsAt ?? now) - now) / 1000 : focusLeft;
  const timeFraction =
    phase === "break" ? Math.max(0, timeLeft ?? 0) / restSeconds : timer.focus && focusLeft !== null ? Math.max(0, focusLeft) / timer.focus : null;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar: leave, how far along, the timer */}
      <header className="sticky top-0 z-10 bg-background/60 backdrop-blur-xl">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" onClick={finish} aria-label="End session" className="shrink-0 text-muted-foreground">
              <XIcon />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {phase === "break" ? "On a break" : timer.focus ? `${timer.label}, block ${block}` : "At your own pace"}
              </p>
            </div>
          </div>
          <div className="hidden w-56 gap-1.5 justify-self-center sm:grid" aria-label={`Card ${Math.min(done + 1, total)} of ${total}`}>
            <p className="text-center text-xs font-medium text-muted-foreground tabular-nums">
              {Math.min(done + 1, total)} of {total}
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <TimerRing fraction={timeFraction} label={timeLeft !== null ? clock(timeLeft) : clock(elapsed)} muted={paused} />
            <MusicButton focused />
            {phase === "focus" && (
              <Button variant="ghost" size="icon" onClick={paused ? resume : pause} aria-label={paused ? "Resume" : "Pause"} className="text-muted-foreground">
                {paused ? <PlayIcon /> : <PauseIcon />}
              </Button>
            )}
            <Button variant="glass" size="sm" onClick={finish} className="hidden sm:inline-flex">
              End
            </Button>
          </div>
        </div>
        <div className="h-0.5 bg-foreground/10 sm:hidden" aria-hidden>
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-2xl">
          {phase === "break" ? (
            <BreakView
              results={results.filter((r) => r.block === block)}
              upNext={queue}
              timeLeft={timeLeft ?? 0}
              fraction={timeFraction ?? 0}
              over={!!breakEndsAt && now >= breakEndsAt}
              onNext={() => {
                setBlock((b) => b + 1);
                startBlock();
              }}
              onEnd={finish}
            />
          ) : paused ? (
            <div className="grid justify-items-center gap-4 py-16 text-center animate-in fade-in duration-200 motion-reduce:animate-none">
              {pet && <PetSprite look={pet} face="closed" className="h-16 w-[60px]" />}
              <div>
                <p className="text-2xl font-semibold tracking-tight">Paused</p>
                <p className="mt-1 text-muted-foreground">The timer and your cards wait for you.</p>
              </div>
              <Button size="lg" onClick={resume}>
                <PlayIcon />
                Resume
              </Button>
            </div>
          ) : current ? (
            <>
              {/* Your buddy perches on top of the card and reacts to each answer */}
              <div className="relative pt-[54px]">
                <Perch pet={pet} reaction={reaction} onExplain={(step) => setAsking({ step, question: "Explain why this is the answer, simply." })} />
                <StepView
                  key={`${current.key}-${stepSeq}`}
                  step={current}
                  spaceId={space?.id}
                  onAnswer={(r, d) => answer(current, r, d)}
                  onNext={next}
                  onFlip={() => pet && playPetSound("flip", pet.species)}
                />
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button variant="glass" onClick={() => current && setAsking({ step: current })}>
                  <MessageCircleQuestionIcon />
                  Ask {pet?.name ?? "your buddy"}
                </Button>
                <Button variant="glass" onClick={takeBreak}>
                  <CoffeeIcon />
                  Take a break
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </main>
      <AskSheet open={!!asking} onOpenChange={(open) => !open && setAsking(null)} step={asking?.step} question={asking?.question} spaceId={space?.id} pet={pet} />
    </div>
  );
}

/* ---------- the timer: a ring that empties as the block runs ---------- */

function TimerRing({ fraction, label, muted, size = 36 }: { fraction: number | null; label: string; muted?: boolean; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("flex items-center gap-2.5", muted && "opacity-60")}>
      {fraction !== null && (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3} className="stroke-foreground/10" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - fraction)}
            className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-linear"
          />
        </svg>
      )}
      <span className="text-xl font-semibold tracking-tight tabular-nums">{label}</span>
    </div>
  );
}

/* ---------- your buddy, sitting on the card ---------- */

function Perch({ pet, reaction, onExplain }: { pet: Pet | null | undefined; reaction: Reaction | null; onExplain: (step: Step) => void }) {
  // One bubble only: the latest line replaces the last, then tucks away (an offer to explain stays longer)
  const [hiddenSeq, setHiddenSeq] = useState(-1);
  useEffect(() => {
    if (!reaction) return;
    const id = setTimeout(() => setHiddenSeq(reaction.seq), reaction.explain ? 8000 : 2200);
    return () => clearTimeout(id);
  }, [reaction]);
  if (!pet) return null;
  const face = reaction?.face ?? "side";
  const line = reaction && reaction.seq !== hiddenSeq ? reaction.line : null;
  return (
    <div className="pointer-events-none absolute top-0 right-6 z-10 flex items-end gap-2 sm:right-10" aria-live="polite">
      <div
        className={cn(
          "mb-6 flex max-w-64 items-center gap-2 rounded-2xl rounded-br-sm bg-card py-1.5 pr-1.5 pl-3 text-sm font-medium shadow-lg ring-1 ring-border transition-[opacity,transform] duration-200",
          !reaction?.explain && "py-2 pr-3",
          line ? "pointer-events-auto translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        )}
      >
        <span>{line ?? reaction?.line}</span>
        {reaction?.explain && (
          <Button size="sm" className="h-7 shrink-0 rounded-full px-3" tabIndex={line ? 0 : -1} onClick={() => onExplain(reaction.explain!)}>
            Explain it
          </Button>
        )}
      </div>
      <PetSprite
        key={reaction?.seq ?? 0}
        look={pet}
        face={face}
        book={face === "side"}
        className={cn(
          "-mb-px h-[60px] w-14 origin-bottom",
          face === "happy" && "animate-[pet-hop_400ms_ease-out] motion-reduce:animate-none",
          face === "flat" && "animate-[pet-squash_400ms_ease-out] motion-reduce:animate-none",
          face === "side" && "animate-[pet-read_2.4s_ease-in-out_infinite] motion-reduce:animate-none"
        )}
      />
    </div>
  );
}

/* ---------- before: what's planned, and the timer ---------- */

const TIMER_ICONS: Record<FocusMethod, typeof TimerIcon> = { pomodoro: TimerIcon, "52-17": HourglassIcon, flow: InfinityIcon };

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
  // Counted by how each card is asked: flipped, typed out, or new (as multiple choice)
  const typed = plan.filter((s) => s.mode === "recall");
  const fresh = plan.filter((s) => s.reason === "new").length;
  const flips = plan.length - typed.length - fresh;
  const weakTopics = [...new Set(typed.map((s) => s.item.card.topic).filter(Boolean))];
  const parts = [
    flips && `${flips} to review`,
    typed.length && `${typed.length} to type out${weakTopics.length ? ` on ${weakTopics.slice(0, 2).join(" and ")}` : ""}`,
    fresh && `${fresh} new`,
  ].filter(Boolean) as string[];
  const sentence = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="p-4 sm:p-6">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link href={backHref}>
            <XIcon />
            Close
          </Link>
        </Button>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 pb-16 text-center">
        {pet && (
          <span className="grid h-32 w-36 place-items-end justify-center overflow-hidden rounded-[28px] bg-[#e7effc] pb-4 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
            <PetSprite look={pet} face="side" book className="h-20 w-[75px] animate-[pet-read_2.4s_ease-in-out_infinite] motion-reduce:animate-none" />
          </span>
        )}
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-balance">{plan.length ? `Ready to study ${title}?` : title}</h1>

        {plan.length === 0 ? (
          <>
            <p className="mt-2 text-muted-foreground">Nothing to study here yet. Add notes to this subject and the flashcards make themselves.</p>
            <Button asChild size="lg" className="mt-8">
              <Link href={backHref}>Go back</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-muted-foreground text-balance">
              {pet?.name ?? "Your buddy"} planned {plan.length} {plan.length === 1 ? "card" : "cards"}: {sentence}. Ones you miss come back before the end.
            </p>

            <ToggleGroup type="single" value={method} onValueChange={(v) => v && setMethod(v as FocusMethod)} className="mt-10 grid w-full grid-cols-3 gap-2" spacing={2}>
              {(Object.keys(TIMERS) as FocusMethod[]).map((m) => {
                const Icon = TIMER_ICONS[m];
                return (
                  <ToggleGroupItem
                    key={m}
                    value={m}
                    className="glass h-auto flex-col gap-1.5 rounded-2xl border border-glass-border bg-glass px-2 py-4 data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                  >
                    <Icon className="size-5" />
                    <span className="text-sm font-semibold">{TIMERS[m].label}</span>
                    <span className="text-xs font-normal text-muted-foreground">{TIMERS[m].short}</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>

            <Button size="lg" className="mt-8 h-12 w-full rounded-xl text-base" onClick={onStart}>
              <PlayIcon />
              Start session
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- a break: your buddy rests, the block is recapped ---------- */

function BreakView({
  results,
  upNext,
  timeLeft,
  fraction,
  over,
  onNext,
  onEnd,
}: {
  results: Result[];
  upNext: Step[];
  timeLeft: number;
  fraction: number;
  over: boolean;
  onNext: () => void;
  onEnd: () => void;
}) {
  const pet = useQuery(petQuery).data;
  const right = results.filter((r) => r.result === "right").length;
  const missed = [...new Map(results.filter((r) => r.result !== "right" && r.step.reason !== "followup").map((r) => [itemKey(r.step.item), r.step])).values()];
  const size = 220;
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;

  return (
    <div className="grid justify-items-center gap-8 text-center animate-in fade-in duration-300 motion-reduce:animate-none">
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} className="stroke-foreground/10" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - fraction)}
            className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-linear"
          />
        </svg>
        <div className="grid justify-items-center gap-1">
          {pet && <PetSprite look={pet} face="closed" className="h-14 w-[52px]" />}
          <p className="text-4xl font-semibold tracking-tight tabular-nums">{over ? "0:00" : clock(timeLeft)}</p>
          <p className="text-sm text-muted-foreground">{over ? "Break's over" : "Break"}</p>
        </div>
      </div>

      <div className="grid gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">{over ? "Ready for the next block?" : "Stand up and stretch"}</h2>
        <p className="text-muted-foreground">
          {results.length
            ? `That block: ${results.length} ${results.length === 1 ? "card" : "cards"}, ${right} right.`
            : "Drink some water and look away from the screen for a bit."}
          {missed.length > 0 && ` ${missed.length === 1 ? "The one" : `The ${missed.length}`} you missed ${missed.length === 1 ? "comes" : "come"} back first.`}
        </p>
      </div>

      {missed.length > 0 && (
        <div className="flex max-w-xl flex-wrap justify-center gap-2">
          {missed.slice(0, 4).map((s) => (
            <Badge key={s.key} variant="outline" className="max-w-full truncate rounded-full px-3 py-1 text-xs font-normal">
              {s.item.card.front}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {upNext.length > 0 && (
          <Button size="lg" onClick={onNext}>
            <PlayIcon />
            {over ? "Start the next block" : "Skip the break"}
          </Button>
        )}
        <Button size="lg" variant="glass" onClick={onEnd}>
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
  const daily = useDailyGoal();
  // Distinct cards studied; follow-ups and repeats of a card count once
  const cards = new Set(results.filter((r) => r.step.reason !== "followup").map((r) => itemKey(r.step.item))).size;
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
    if (pet && results.length) playPetSound("done", pet.species);
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
    // Once, when the summary opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedSeconds, method, startedAt, space?.id, xp, queryClient, onSaved]);

  const good = accuracy !== null && accuracy >= 0.7;
  const headline = results.length === 0 ? "Session ended" : good ? "Great session" : "Good work showing up";
  const line =
    results.length === 0
      ? "Nothing answered this time. Come back when you're ready."
      : good
        ? `You knew most of it.${missedTopics[0] ? ` Keep an eye on ${missedTopics[0]}.` : ""}`
        : `${missedTopics[0] ? `${missedTopics[0]} needs another go.` : "The ones you missed come back soon."} That's how it sticks.`;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-5 py-12 text-center animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none">
      {pet && (
        <span className="grid h-32 w-36 place-items-end justify-center overflow-hidden rounded-[28px] bg-[#e7effc] pb-4 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
          <PetSprite
            look={pet}
            face={good || results.length === 0 ? "happy" : "open"}
            className="h-20 w-[75px] origin-bottom animate-[pet-hop_500ms_ease-out_2] motion-reduce:animate-none"
          />
        </span>
      )}
      <h1 className="mt-6 text-3xl font-bold tracking-tight">{headline}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{title}</p>
      <p className="mt-4 text-lg text-balance">{line}</p>
      {daily.goal > 0 && (
        <p className={cn("mt-3 text-sm font-medium", daily.reached ? "text-success" : "text-muted-foreground")}>
          {daily.reached ? `You hit today's goal of ${daily.goal} cards.` : `Today's goal: ${daily.done} of ${daily.goal} cards.`}
        </p>
      )}

      <dl className="glass mt-8 grid w-full grid-cols-4 rounded-2xl border border-glass-border bg-glass">
        {[
          ["Cards", String(cards)],
          ["Right", accuracy === null ? "None" : `${Math.round(accuracy * 100)}%`],
          ["Focused", `${minutes}m`],
          ["XP", `+${xp}`],
        ].map(([label, value], i) => (
          <div key={label} className={cn("px-2 py-4", i > 0 && "border-l border-glass-divider")}>
            <dd className="text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
            <dt className="mt-0.5 text-xs text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>

      {missedTopics.length > 0 && (
        <div className="mt-6 grid justify-items-center gap-2">
          <p className="text-sm font-medium">Work on next</p>
          <div className="flex flex-wrap justify-center gap-2">
            {missedTopics.slice(0, 4).map((t) => (
              <Badge key={t} variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button size="lg" asChild>
          <Link href={backHref}>{space ? `Back to ${space.name}` : "Back to Today"}</Link>
        </Button>
        {space && (
          <Button size="lg" variant="glass" asChild>
            <Link href="/study">Today</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
