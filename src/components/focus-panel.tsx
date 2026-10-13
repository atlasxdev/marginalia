"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PauseIcon, PlayIcon, SquareIcon, TimerIcon } from "lucide-react";
import { METHODS, clock, useFocus } from "@/lib/focus";
import { isDue } from "@/lib/leitner";
import { petQuery, studyQuery } from "@/lib/queries";
import type { FocusMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PetSprite } from "./pet/pet-sprite";

/** Focusing with your buddy: it studies beside the timer and rests with you on breaks. */
export function FocusPanel() {
  const focus = useFocus();
  const { state, method, seconds } = focus;
  const pet = useQuery(petQuery).data;
  const due =
    useQuery(studyQuery).data?.decks.reduce((n, d) => n + d.payload.cards.filter((_, i) => isDue(d.state.cards?.[i])).length, 0) ?? 0;
  const running = state.phase !== "idle";
  const active = running ? state.method : method;
  const paused = state.phase === "focus" && state.pausedLeft !== null;
  const config = METHODS[active];
  const total = state.phase === "break" ? null : state.phase === "focus" && state.endsAt ? config.focus : null;
  const name = pet?.name ?? "Your buddy";

  const line =
    state.phase === "idle"
      ? `${name} will study with you. Pick a timer and start.`
      : state.phase === "break"
        ? "Break time. Stretch, drink some water, look away from the screen."
        : paused
          ? "Paused. Pick up where you left off when you're ready."
          : state.endsAt
            ? "Studying with you. Phone down, one thing at a time."
            : "Studying with you. Stop when your focus fades, and you'll get a break.";

  return (
    <Dialog open={focus.open} onOpenChange={focus.setOpen}>
      <DialogContent className="glass gap-6 border border-glass-border bg-glass-strong sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Focus with {name}</DialogTitle>
          <DialogDescription>{line}</DialogDescription>
        </DialogHeader>

        {!running && (
          <div className="grid gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              value={method}
              onValueChange={(v) => v && focus.setMethod(v as FocusMethod)}
              className="w-full"
            >
              {(Object.keys(METHODS) as FocusMethod[]).map((m) => (
                <ToggleGroupItem key={m} value={m} className="flex-1">
                  {METHODS[m].name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-center text-xs text-muted-foreground">{METHODS[method].detail}.</p>
          </div>
        )}

        {/* The desk: your buddy and the clock */}
        <div className="grid justify-items-center gap-3 rounded-2xl bg-[#e7effc] px-6 pt-8 pb-6 dark:bg-[#2b354a]">
          {pet && (
            <PetSprite
              look={pet}
              face={state.phase === "break" ? "closed" : state.phase === "focus" ? "side" : "open"}
              book={state.phase === "focus"}
              className={cn(
                "h-[76px] w-[72px]",
                state.phase === "focus" && !paused && "animate-[pet-read_2.4s_ease-in-out_infinite] motion-reduce:animate-none"
              )}
            />
          )}
          <p className="text-5xl font-semibold tracking-tight text-foreground tabular-nums" aria-live="off">
            {clock(seconds)}
          </p>
          <p className="text-sm text-muted-foreground">
            {state.phase === "idle"
              ? config.focus
                ? "Ready when you are"
                : "Counts up until you stop"
              : state.phase === "break"
                ? "Break"
                : `Focus, round ${state.round}`}
          </p>
          {state.phase === "focus" && total && (
            <div className="h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
              <div className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${(1 - seconds / total) * 100}%` }} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {state.phase === "idle" && (
            <Button size="lg" onClick={focus.start}>
              <PlayIcon />
              Start focusing
            </Button>
          )}
          {state.phase === "focus" && state.endsAt && (
            <Button size="lg" variant="outline" onClick={paused ? focus.resume : focus.pause}>
              {paused ? <PlayIcon /> : <PauseIcon />}
              {paused ? "Resume" : "Pause"}
            </Button>
          )}
          {state.phase === "focus" && (
            <Button size="lg" variant={state.endsAt ? "ghost" : "default"} onClick={focus.stop}>
              <SquareIcon />
              {state.endsAt ? "End early" : "Stop and take a break"}
            </Button>
          )}
          {state.phase === "break" && (
            <>
              <Button size="lg" onClick={focus.start}>
                <PlayIcon />
                Skip break
              </Button>
              <Button size="lg" variant="ghost" onClick={focus.stop}>
                Done for now
              </Button>
            </>
          )}
        </div>

        {state.phase === "break" && due > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            After your break, {due} {due === 1 ? "card is" : "cards are"} due.{" "}
            <Link href="/study" onClick={() => focus.setOpen(false)} className="text-primary hover:underline">
              Go to Study
            </Link>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A small timer that opens the panel, for wherever the sidebar isn't. */
export function FocusChip({ className }: { className?: string }) {
  const { state, seconds, setOpen } = useFocus();
  if (state.phase === "idle") return null;
  return (
    <Button variant="glass" size="sm" onClick={() => setOpen(true)} className={cn("tabular-nums", className)}>
      <TimerIcon className="text-primary" />
      {state.phase === "break" ? "Break" : "Focus"} {clock(seconds)}
    </Button>
  );
}
