"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { DEFAULT_LOOK } from "@/lib/pet-art";
import { playPetSound } from "@/lib/pet-sounds";
import { petQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Buddy, Burst, Typed } from "./buddy-talk";

const QUEUED = "marginalia:tour";

/** Asks for the guided tour on the next page the app opens (your first subject, or Today if you skipped). */
export function queueTour() {
  try {
    sessionStorage.setItem(QUEUED, "1");
  } catch {
    // Storage can be blocked; the tour is a nice-to-have
  }
}

function queued(clear = false) {
  try {
    if (clear) sessionStorage.removeItem(QUEUED);
    return sessionStorage.getItem(QUEUED) === "1";
  } catch {
    return false;
  }
}

/* Each stop lights up one part of the real page, found by its data-tour name.
   A stop whose part isn't on screen (another page's, or the sidebar on a phone) is left out. */
const STOPS: { target: string; text: (buddy: string) => string }[] = [
  { target: "subject-next", text: () => "This is your class. The box up top always shows your next step, like making flashcards or studying them." },
  { target: "subject-tabs", text: () => "Study has your flashcards. Ask answers questions from your notes. Notes holds your files." },
  { target: "today", text: () => "This is Today. Your goal, your streak and what to study next, all in one place." },
  { target: "menu", text: (buddy) => `Tap here for Today, Events and all your classes. ${buddy} is in there too. Let's study!` },
  { target: "nav-today", text: () => "Today picks what to study each day, across all your classes. It's always here." },
  { target: "nav-exams", text: () => "Got a test or a deadline coming? Add it here. Link its subjects and I'll plan the days before it." },
  { target: "nav-subjects", text: () => "Every class you add shows up here." },
  { target: "buddy", text: (buddy) => `And that's me, ${buddy}. Tap me anytime to check in. Let's study!` },
];

const PAD = 8;
const CARD_W = 360;
const GAP = 16;
// Roughly how tall the card is, to tell whether it fits above or below
const CARD_H = 190;

type Rect = { top: number; left: number; width: number; height: number };

function find(target: string) {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width && r.height ? { el, rect: r } : null;
}

export function Tour() {
  const [stops, setStops] = useState<typeof STOPS | null>(null);
  const [i, setI] = useState(0);

  // When queued, waits for the page to render its parts, then keeps the stops that are on screen
  useEffect(() => {
    if (!queued()) return;
    const started = Date.now();
    let seen = 0;
    let frame = 0;
    const tick = () => {
      const now = Date.now();
      if (!seen && STOPS.some((s) => find(s.target))) seen = now;
      // Once one part is up, gives the rest of the page a moment to land
      if ((seen && now - seen > 400) || now - started > 5000) {
        const shown = STOPS.filter((s) => find(s.target));
        queued(true);
        if (shown.length) {
          setI(0);
          setStops(shown);
        }
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!stops) return null;
  return createPortal(<Stop stops={stops} i={i} setI={setI} onEnd={() => setStops(null)} />, document.body);
}

function Stop({ stops, i, setI, onEnd }: { stops: typeof STOPS; i: number; setI: (i: number) => void; onEnd: () => void }) {
  const reduced = useReducedMotion();
  const pet = useQuery(petQuery).data;
  const look = pet ?? DEFAULT_LOOK;
  const [rect, setRect] = useState<Rect | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const stop = stops[i];
  const last = i === stops.length - 1;

  const measure = useCallback(() => {
    const found = find(stop.target);
    setView({ w: window.innerWidth, h: window.innerHeight });
    if (!found) return setRect(null);
    const r = found.rect;
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [stop.target]);

  // Brings the part into view, then follows it as the page scrolls, resizes or the part itself changes size
  useLayoutEffect(() => {
    find(stop.target)?.el.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    const now = requestAnimationFrame(measure);
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const watch = new ResizeObserver(measure);
    const el = find(stop.target)?.el;
    if (el) watch.observe(el);
    return () => {
      watch.disconnect();
      cancelAnimationFrame(now);
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [stop.target, measure, reduced]);

  useEffect(() => {
    playPetSound(last ? "done" : "hi", look.species);
  }, [i, last, look.species]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEnd();
      if (e.key === "ArrowRight") {
        if (last) onEnd();
        else setI(i + 1);
      }
      if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [i, last, onEnd, setI]);

  if (!rect) return null;

  // The card sits beside the part when there's room on the right (the sidebar), else below or above it.
  // A part too tall for either (a big card on a phone) gets the card along the bottom of the screen, over it.
  const width = Math.min(CARD_W, view.w - 32);
  const right = rect.left + rect.width + GAP + width < view.w && rect.width < view.w / 3;
  const below = rect.top + rect.height + GAP + CARD_H < view.h;
  const above = rect.top - GAP - CARD_H > 0;
  const left = Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, view.w - width - 16));
  const pos = right
    ? { left: rect.left + rect.width + GAP, top: Math.max(16, Math.min(rect.top + rect.height / 2 - 50, view.h - CARD_H)) }
    : below
      ? { left, top: rect.top + rect.height + GAP }
      : above
        ? { left, bottom: view.h - rect.top + GAP }
        : { left, bottom: 16 };
  // The arrow points at the middle of the lit part; none when the card sits over it
  const arrow = right
    ? { left: -6, top: Math.max(18, Math.min(rect.top + rect.height / 2 - (pos.top ?? 0) - 6, 130)) }
    : below || above
      ? { left: Math.max(18, Math.min(rect.left + rect.width / 2 - left - 6, width - 30)), ...(below ? { top: -6 } : { bottom: -6 }) }
      : null;
  const text = stop.text(pet?.name ?? "your buddy");

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal aria-label="Tour of Marginalia">
      {/* Catches clicks so the page stays still while the tour runs */}
      <div className="absolute inset-0" />
      {/* The light: everything dims except the part being shown */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute rounded-2xl ring-2 ring-primary/80"
        style={{ boxShadow: "0 0 0 9999px rgb(8 14 30 / 0.6)" }}
        initial={false}
        animate={rect}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }}
      />
      {/* A ring that keeps rippling out from the lit part, so the eye goes there */}
      {!reduced && (
        <motion.div
          key={i}
          aria-hidden
          className="pointer-events-none absolute rounded-3xl ring-2 ring-primary"
          initial={{ opacity: 0, ...rect }}
          animate={{
            top: [rect.top, rect.top - 10],
            left: [rect.left, rect.left - 10],
            width: [rect.width, rect.width + 20],
            height: [rect.height, rect.height + 20],
            opacity: [0.8, 0],
          }}
          transition={{ duration: 1.6, delay: 0.45, repeat: Infinity, repeatDelay: 0.3, ease: "easeOut" }}
        />
      )}

      <motion.div
        key={`card-${i}`}
        initial={reduced ? false : { opacity: 0, scale: 0.94, y: below || right ? 8 : -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 460, damping: 30, delay: reduced ? 0 : 0.1 }}
        className="absolute rounded-3xl bg-popover p-5 text-popover-foreground shadow-2xl ring-1 ring-foreground/10"
        style={{ ...pos, width }}
      >
        {arrow && <span aria-hidden className="absolute size-3 rotate-45 bg-popover" style={arrow} />}
        {/* Your buddy, saying what this part is */}
        <div className="flex items-end gap-3.5">
          <div className="relative shrink-0">
            <Burst fire={last ? 1 : 0} color={look.color} />
            <Buddy look={look} face={last ? "happy" : "open"} hop={i} className="h-[64px] w-[60px]" />
            <div aria-hidden className="mx-auto mt-0.5 h-1.5 w-12 rounded-[100%] bg-foreground/10" />
          </div>
          <p className="min-h-[64px] flex-1 self-center text-[15px] leading-snug font-medium text-pretty">
            <Typed key={text} text={text} />
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {/* How far along, as dots */}
          <div className="mr-auto flex items-center gap-1.5">
            <span className="sr-only">
              Step {i + 1} of {stops.length}
            </span>
            {stops.map((s, n) => (
              <span
                key={s.target}
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  n === i ? "w-5 bg-primary" : n < i ? "w-1.5 bg-primary/40" : "w-1.5 bg-foreground/15"
                )}
              />
            ))}
          </div>
          {!last && (
            <Button variant="ghost" size="sm" onClick={onEnd} className="text-muted-foreground">
              Skip
            </Button>
          )}
          {i > 0 && (
            <Button variant="outline" size="sm" onClick={() => setI(i - 1)}>
              Back
            </Button>
          )}
          <Button size="sm" autoFocus onClick={() => (last ? onEnd() : setI(i + 1))}>
            {last ? "Start studying" : "Next"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
