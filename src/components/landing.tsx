"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CircleDashed, FileText } from "lucide-react";
import { motion } from "motion/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_LOOK } from "@/lib/pet-art";
import { cn } from "@/lib/utils";
import type { StudyStatus } from "@/lib/pet-care";
import { useHydrated } from "@/lib/use-hydrated";
import { PetDevice } from "./pet/pet-device";
import { PetSprite } from "./pet/pet-sprite";

/*
 * The landing page's moving parts, drawn from the app's own tokens and classes
 * (.cite, glass, the highlight colours) so they follow the theme. Everything
 * settles to its final state when the visitor prefers reduced motion.
 */

const BRACKET =
  "M16 3c-5 .5-9 0-11.5.8C3.4 20 4.6 50 3.6 70c-.3 9 .6 18 .2 26 3.6.8 8 .2 12.2.6l.4-5c-2.6-.4-5.2 0-7.6-.4.5-8-.3-17 .1-25 .6-19-.3-42 .4-58 2.4-.4 5 .1 7.2-.3z";

/* ---------- hooks ---------- */

function useMedia(query: string, serverValue = false) {
  return useSyncExternalStore(
    (on) => {
      const q = window.matchMedia(query);
      q.addEventListener("change", on);
      return () => q.removeEventListener("change", on);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");

function useInView<T extends Element>(options: { once?: boolean; margin?: string } = {}) {
  const { once = true, margin = "0px 0px -15% 0px" } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting && once) io.disconnect();
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, margin]);
  return [ref, inView] as const;
}

/**
 * Milliseconds since `key` last changed, ticking only while `running`.
 * Calls `onEnd` once the clock passes `end`.
 */
function useClock(running: boolean, key: unknown, end = Infinity, onEnd?: () => void) {
  const [clock, setClock] = useState({ key, t: 0 });
  const t = clock.key === key ? clock.t : 0;
  const endRef = useRef({ end, onEnd });
  const fired = useRef<unknown>(undefined);
  useEffect(() => {
    endRef.current = { end, onEnd };
  });
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      setClock((c) => {
        const next = (c.key === key ? c.t : 0) + dt;
        if (next >= endRef.current.end && fired.current !== key) {
          fired.current = key;
          queueMicrotask(() => endRef.current.onEnd?.());
        }
        return { key, t: next };
      });
    };
    const id = setInterval(tick, 33);
    return () => clearInterval(id);
  }, [running, key]);
  return t;
}

/* ---------- small pieces ---------- */

/** Fades and lifts its children in when they scroll into view. */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-[opacity,translate,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        inView ? "translate-y-0 opacity-100 blur-0" : "translate-y-3 opacity-0 blur-[2px] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The logo's bracket, drawn down the left of a passage. */
function MarginBracket({ drawn }: { drawn: boolean }) {
  return (
    <svg
      viewBox="0 0 20 100"
      preserveAspectRatio="none"
      aria-hidden
      className={cn(
        "absolute top-1 bottom-1 -left-5 w-2.5 origin-top text-primary transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:-left-7 sm:w-3",
        drawn ? "scale-y-100" : "scale-y-0",
      )}
    >
      <path d={BRACKET} fill="currentColor" />
    </svg>
  );
}

function MiniWordmark() {
  return (
    <span className="inline-flex items-center gap-px font-serif text-sm font-semibold leading-none">
      <svg viewBox="0 0 20 100" aria-hidden className="h-4 w-1 text-primary"><path d={BRACKET} fill="currentColor" /></svg>
      <span className="pb-px">marginalia</span>
      <svg viewBox="0 0 20 100" aria-hidden className="h-4 w-1 -scale-x-100 text-primary"><path d={BRACKET} fill="currentColor" /></svg>
    </span>
  );
}

/** Text with a highlighter sweeping across it, like the app's cited passages. */
function Marked({ on, bright, children }: { on: boolean; bright?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn("rounded-[0.2em] px-[0.1em] transition-[background-size,background-color,color] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] [box-decoration-break:clone]", on && "text-on-highlight")}
      style={{
        backgroundImage: `linear-gradient(var(${bright ? "--highlight" : "--highlight-soft"}), var(${bright ? "--highlight" : "--highlight-soft"}))`,
        backgroundRepeat: "no-repeat",
        backgroundSize: on ? "100% 100%" : "0% 100%",
      }}
    >
      {children}
    </span>
  );
}

type Seg = { t: string; b?: boolean };
/** "**bold**" spans, word by word. */
function words(s: string): Seg[] {
  let bold = false;
  return s.split(" ").map((w) => {
    const open = w.startsWith("**");
    if (open) bold = true;
    const seg = { t: w.replaceAll("**", ""), b: bold };
    if (w.endsWith("**") && (!open || w.length > 4)) bold = false;
    return seg;
  });
}

/** Marginalia's answer, as a frosted note. `shown` streams it in word by word. */
export function AnswerNote({
  question, answer, shown = Infinity, cited = true, source, onCite, className,
}: { question: string; answer: string; shown?: number; cited?: boolean; source?: string; onCite?: (on: boolean) => void; className?: string }) {
  const segs = words(answer);
  const done = shown >= segs.length;
  return (
    <div className={cn("glass rounded-xl border border-glass-border bg-glass p-4 text-left", className)}>
      <MiniWordmark />
      <p className="mt-2 text-xs text-muted-foreground">{question}</p>
      <p className="mt-1 min-h-[3.1em] text-[0.9375rem] leading-relaxed">
        {segs.slice(0, shown).map((s, i) => (
          <span key={i} className={cn("animate-in fade-in duration-150", s.b && "font-semibold")}>{s.t} </span>
        ))}
        {done ? (
          <button
            type="button"
            className="cite cursor-pointer"
            data-active={cited}
            aria-label={`Source: ${source ?? "your document"}`}
            onMouseEnter={() => onCite?.(true)}
            onMouseLeave={() => onCite?.(false)}
            onFocus={() => onCite?.(true)}
            onBlur={() => onCite?.(false)}
          >
            1
          </button>
        ) : (
          <span className="ml-1 inline-block size-2 animate-pulse rounded-full bg-muted-foreground align-middle" />
        )}
      </p>
      {source && <p className="mt-3 border-t border-glass-divider pt-2 text-xs text-muted-foreground">{source}</p>}
    </div>
  );
}

/**
 * A segmented control: a frosted track with a thumb that slides to the chosen
 * option. Built on the shadcn ToggleGroup, so it keeps its keyboard handling.
 */
function Segmented({ id, label, value, onChange, items }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string; icon?: React.ReactNode }[];
}) {
  const reduced = useReducedMotion();
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v)}
      aria-label={label}
      className="glass gap-0.5 rounded-full border border-glass-border bg-glass p-1"
    >
      {items.map((it) => {
        const on = it.value === value;
        return (
          <ToggleGroupItem
            key={it.value}
            value={it.value}
            className={cn(
              "relative h-9 gap-2 rounded-full! border-0 bg-transparent! px-3.5 text-sm font-medium transition-colors duration-200 hover:bg-transparent sm:px-4",
              on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on && (
              <motion.span
                layoutId={`${id}-thumb`}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }}
                className="absolute inset-0 rounded-full bg-card shadow-sm ring-1 ring-foreground/10"
              />
            )}
            {it.icon && (
              <span className={cn("relative grid size-5 place-items-center transition-colors [&_svg]:size-4", on ? "text-primary" : "")}>{it.icon}</span>
            )}
            <span className={cn("relative", it.icon && "max-sm:hidden sm:inline", on && "max-sm:inline")}>{it.label}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export function StreamedAnswer({ question, answer, source, delay = 0 }: { question: string; answer: string; source?: string; delay?: number }) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [hover, setHover] = useState(0);
  const t = useClock(inView, hover);
  const shown = reduced ? Infinity : Math.max(0, Math.floor((t - delay) / 45));
  return (
    <div ref={ref} onMouseEnter={() => setHover((h) => h + 1)}>
      <AnswerNote question={question} answer={answer} shown={shown} source={source} />
    </div>
  );
}

/* ---------- cards that catch the light ---------- */

/** A glass card with a soft glow that follows the pointer and a slight tilt. */
export function SpotlightCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--x", `${x * 100}%`);
    el.style.setProperty("--y", `${y * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - y) * 6}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 6}deg`);
  };
  const leave = () => {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };
  return (
    <div style={{ perspective: 900 }} className="h-full">
      <div
        ref={ref}
        onPointerMove={move}
        onPointerLeave={leave}
        className={cn(
          "group/spot glass relative h-full overflow-hidden rounded-xl border border-glass-border bg-glass transition-transform duration-150 ease-out [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] motion-reduce:transform-none",
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover/spot:opacity-100" style={{ background: "radial-gradient(420px circle at var(--x,50%) var(--y,50%), color-mix(in srgb, var(--primary) 16%, transparent), transparent 60%)" }} />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

/* ---------- how it works: the steps as a fanned stack of cards ---------- */

/*
 * Like the certifications fan on aceguevarra.xyz: the current step stands
 * upright in the middle, the others tilt out behind it. Each card plays its
 * own small moment when it comes forward. It advances by itself while on
 * screen; clicking a card, a tab or the arrow keys brings a step forward.
 */
const FAN_OFFSET = [0, 62];
const FAN_ROTATE = 8;
const FAN_SCALE = 0.1;
const STEP_MS = 3400;

/** A card's own moment, replayed each time it comes to the front. */
function useStepClock(front: boolean) {
  const reduced = useReducedMotion();
  const [round, setRound] = useState(0);
  const [wasFront, setWasFront] = useState(front);
  if (front !== wasFront) {
    setWasFront(front);
    if (front) setRound((r) => r + 1);
  }
  const t = useClock(front, round);
  return reduced ? Infinity : t;
}

function SignUpCard({ front }: { front: boolean }) {
  const t = useStepClock(front);
  const email = "you@example.com".slice(0, Math.max(0, Math.floor((t - 200) / 40)));
  const dots = Math.min(10, Math.max(0, Math.floor((t - 900) / 45)));
  const pressed = t > 1500 && t < 1650;
  const done = t >= 1650;
  return (
    <div className="space-y-2.5">
      <div className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
        <span className="text-xs text-muted-foreground">Email</span>
        <p className="h-5 truncate">{email}{t < 900 && <span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-primary" />}</p>
      </div>
      <div className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
        <span className="text-xs text-muted-foreground">Password</span>
        <p className="h-5 tracking-widest">{"•".repeat(dots)}</p>
      </div>
      <div className={cn("raised flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-transform duration-150", pressed && "scale-95")}>
        {done ? <span className="animate-in fade-in zoom-in-75 duration-200">Account created ✓</span> : "Create account"}
      </div>
    </div>
  );
}

const DROPPED: [string, string, string][] = [
  ["PDF", "bg-destructive", "Biology lecture 3.pdf"],
  ["DOC", "bg-primary", "History reading, ch 9.docx"],
  ["MD", "bg-muted-foreground", "Midterm reviewer.md"],
];
function FilesCard({ front }: { front: boolean }) {
  const t = useStepClock(front);
  return (
    <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-2.5">
      <ul className="space-y-1.5">
        {DROPPED.map(([tag, color, name], i) => {
          const at = 250 + i * 380;
          const ready = t > at + 900;
          return (
            <li
              key={name}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-card px-2.5 py-2 text-xs ring-1 ring-foreground/10 transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                t > at ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
              )}
            >
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold text-white", color)}>{tag}</span>
              <span className="flex-1 truncate font-medium">{name}</span>
              <span className={cn("shrink-0 font-medium transition-colors", ready ? "text-success" : "text-muted-foreground")}>
                {ready ? "Ready ✓" : t > at ? "Reading…" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// A flashcard from your notes flips, and you got it
function StudyCard({ front }: { front: boolean }) {
  const t = useStepClock(front);
  const flipped = t > 1100;
  const rated = t > 2200;
  return (
    <div className="space-y-2.5">
      <div className="perspective-[900px]">
        <div className={cn("relative grid h-[7.6rem] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform-3d motion-reduce:transition-none", flipped && "rotate-y-180")}>
          <div className="col-start-1 row-start-1 flex flex-col rounded-xl bg-card p-3 ring-1 ring-foreground/10 backface-hidden">
            <span className="text-[10px] font-medium text-muted-foreground">Glycolysis</span>
            <p className="my-auto text-center text-sm font-medium">Where does glycolysis happen?</p>
          </div>
          <div className="col-start-1 row-start-1 flex rotate-y-180 flex-col rounded-xl bg-primary/5 p-3 ring-1 ring-foreground/10 backface-hidden">
            <span className="text-[10px] font-medium text-muted-foreground">Answer</span>
            <p className="my-auto text-center text-sm font-medium">In the cytoplasm</p>
            <span className="truncate text-[10px] text-muted-foreground">From Biology lecture 3</span>
          </div>
        </div>
      </div>
      <div className="grid h-10 grid-cols-2 gap-2 text-sm font-medium">
        <span className="grid place-items-center rounded-lg border border-input bg-background">Again</span>
        <span className={cn("raised grid place-items-center rounded-lg bg-primary text-primary-foreground transition-transform duration-150", rated && t < 2400 && "scale-95")}>
          {rated ? <span className="animate-in fade-in zoom-in-75 duration-200">Got it ✓</span> : "Got it"}
        </span>
      </div>
    </div>
  );
}

const STEP_SCENES = [SignUpCard, FilesCard, StudyCard];

export function Steps({ steps }: { steps: { title: string; body: string }[] }) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, margin: "0px" });
  const [active, setActive] = useState(0);
  const [hold, setHold] = useState(false);
  const desktop = useMedia("(min-width: 768px)", true);
  const n = steps.length;
  const go = (i: number) => setActive(((i % n) + n) % n);
  useClock(inView && !hold && !reduced, active, STEP_MS, () => go(active + 1));
  const offset = desktop ? FAN_OFFSET : [0, 34];

  return (
    <div ref={ref} className="mt-10" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      <div
        role="group"
        aria-label="How it works"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(active + 1);
          else if (e.key === "ArrowLeft") go(active - 1);
          else return;
          e.preventDefault();
        }}
        className="relative flex h-[25rem] items-center justify-center overflow-x-clip sm:h-[27rem]"
      >
        {steps.map((s, i) => {
          const half = Math.floor(n / 2);
          const d = ((i - active + n + half) % n) - half;
          const dist = Math.min(Math.abs(d), offset.length - 1);
          const sign = Math.sign(d);
          const front = d === 0;
          const Scene = STEP_SCENES[i];
          return (
            <motion.div
              key={s.title}
              initial={false}
              animate={{ x: `${sign * offset[dist]}%`, rotate: sign * dist * FAN_ROTATE, scale: 1 - dist * FAN_SCALE }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 26 }}
              style={{ zIndex: 10 - dist }}
              className="absolute"
            >
              <div
                className={cn(
                  "relative flex h-[22rem] w-[17rem] flex-col overflow-hidden rounded-2xl bg-card shadow-xl ring-1 ring-foreground/10 transition-[filter] duration-200 sm:h-[24rem] sm:w-[21rem] dark:shadow-black/40",
                  !front && "brightness-[0.97] saturate-50 hover:brightness-100 dark:brightness-75",
                )}
              >
                <div className="flex flex-1 flex-col justify-center bg-[radial-gradient(120%_80%_at_0%_0%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_70%)] p-4 sm:p-5">
                  <Scene front={front && inView} />
                </div>
                <div className="border-t border-border px-5 py-4">
                  <p className="text-xs font-medium text-primary">Step {i + 1}</p>
                  <h3 className="mt-0.5 text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </div>
                {/* Selects the card when it's behind */}
                {!front && (
                  <button type="button" onClick={() => go(i)} aria-label={`Step ${i + 1}: ${s.title}`} className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <Segmented
          id="steps"
          label="Steps"
          value={String(active)}
          onChange={(v) => go(Number(v))}
          items={steps.map((s, i) => ({ value: String(i), label: s.title, icon: <span className="text-xs tabular-nums">{i + 1}</span> }))}
        />
      </div>
    </div>
  );
}

/* ---------- the wordmark, drawn in for the closing call to action ---------- */

export function OpeningWordmark() {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="inline-grid justify-items-end">
      <span className="inline-flex items-center gap-[0.1em] font-serif text-5xl font-semibold leading-none sm:text-6xl">
        <svg viewBox="0 0 20 100" aria-hidden className={cn("h-[1.2em] w-[0.24em] text-primary transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none", inView ? "translate-x-0" : "translate-x-[1.6em]")}><path d={BRACKET} fill="currentColor" /></svg>
        <span className={cn("pb-[0.08em] transition-[clip-path] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none", inView ? "[clip-path:inset(0_0_0_0)]" : "[clip-path:inset(0_50%_0_50%)]")}>marginalia</span>
        <svg viewBox="0 0 20 100" aria-hidden className={cn("h-[1.2em] w-[0.24em] -scale-x-100 text-primary transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none", inView ? "translate-x-0" : "-translate-x-[1.6em]")}><path d={BRACKET} fill="currentColor" /></svg>
      </span>
      <p className={cn("mt-1 mr-6 -rotate-3 font-hand text-2xl text-primary transition-[clip-path] delay-300 duration-400 motion-reduce:transition-none", inView ? "[clip-path:inset(-20%_0_-20%_0)]" : "[clip-path:inset(-20%_100%_-20%_0)]")}>
        notes in the margin
      </p>
    </div>
  );
}

/* ---------- the nav firms up once you scroll ---------- */

export function NavShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <nav className={cn("glass mx-auto flex h-14 max-w-6xl items-center justify-between rounded-xl border border-glass-border pr-2 pl-4 transition-[background-color,max-width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]", scrolled ? "max-w-5xl bg-glass-strong" : "bg-glass")}>
      {children}
    </nav>
  );
}

export const DocChip = ({ name }: { name: string }) => (
  <span className="inline-flex items-center gap-1.5 truncate text-xs text-muted-foreground">
    <FileText className="size-3.5 shrink-0" />
    <span className="truncate">{name}</span>
  </span>
);

/* ---------- the auth screens' showcase panel ---------- */

/** The right half of sign-in and sign-up: a page, its passage marked, the answer beside it. */
export function AuthShowcase() {
  const [ref, inView] = useInView<HTMLDivElement>({ margin: "0px" });
  return (
    <div ref={ref} className="w-full max-w-lg">
      <div className="relative rounded-2xl bg-card p-7 text-left shadow-xl ring-1 ring-foreground/10 dark:shadow-black/40">
        <p className="text-xs text-muted-foreground">Biology notes, lecture 3</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight">Cellular respiration</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Cellular respiration turns glucose into ATP, the cell&apos;s energy, in three stages.</p>
        <p className="relative mt-3 ml-5 text-sm leading-relaxed">
          <MarginBracket drawn={inView} />
          <Marked on={inView}>Glycolysis happens in the cytoplasm and splits one glucose into two pyruvate, for a net gain of 2 ATP.</Marked>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">The Krebs cycle runs in the mitochondrial matrix and releases carbon dioxide.</p>
        <div className="mt-5 lg:absolute lg:top-full lg:-right-8 lg:-mt-8 lg:w-80">
          <StreamedAnswer question="Where does glycolysis happen?" answer="In the **cytoplasm,** and it nets **2 ATP** per glucose." source="Biology notes, lecture 3" delay={500} />
        </div>
      </div>
      <p className="mt-10 text-2xl font-semibold tracking-tight text-balance lg:mt-44">Study from your own notes, with a buddy that keeps you going.</p>
      <p className="mt-2 text-muted-foreground">Flashcards, quizzes and answers, each cited to the line it came from.</p>
    </div>
  );
}

/* ---------- test me: a typed answer, checked against the notes ---------- */

const RECALL = {
  topic: "Krebs cycle",
  q: "Where does the Krebs cycle take place?",
  typed: "in the mitochondria",
  feedback: "Close. It's the mitochondrial **matrix** specifically.",
  source: "Biology notes › Krebs cycle",
};

export function RecallDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, margin: "0px" });
  const [round, setRound] = useState(0);
  const typeEnd = 500 + RECALL.typed.length * 55;
  const pressAt = typeEnd + 350;
  const checkedAt = pressAt + 900;
  const t = useClock(inView, round, checkedAt + 4200, () => setRound((r) => r + 1));
  const now = reduced ? checkedAt + 2000 : t;
  const typed = RECALL.typed.slice(0, Math.max(0, Math.floor((now - 500) / 55)));
  const checking = now >= pressAt && now < checkedAt;
  const checked = now >= checkedAt;
  const shown = Math.max(0, Math.floor((now - checkedAt - 200) / 45));

  return (
    <div ref={ref} className="rounded-2xl bg-card p-6 text-left shadow-xl ring-1 ring-foreground/10 dark:shadow-black/40">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-end justify-center overflow-hidden rounded-xl bg-[#e7effc] pb-1 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
          <PetSprite
            key={checked ? "checked" : "reading"}
            look={DEFAULT_LOOK}
            face={checked ? "flat" : "side"}
            book={!checked}
            className={cn("h-8 w-[30px] origin-bottom", checked && !reduced && "animate-[pet-squash_400ms_ease-out]")}
          />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">Test me</p>
          <p className="text-sm text-muted-foreground">{checked ? "Almost. We'll come back to it." : "Answer in your own words."}</p>
        </div>
      </div>
      <p className="mt-6 text-xs font-medium text-muted-foreground">{RECALL.topic}</p>
      <p className="mt-1 text-lg font-medium">{RECALL.q}</p>
      <div className={cn("mt-4 flex h-12 items-center rounded-lg border bg-background px-3.5 transition-colors", checked ? "border-amber-500" : "border-input")}>
        <span className={cn("flex-1 truncate", !typed && "text-muted-foreground")}>{typed || "Your answer"}</span>
        {!checked && typed && now < pressAt && <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-primary" />}
        {checked && <CircleDashed aria-label="Almost" className="size-5 shrink-0 text-amber-500" />}
      </div>
      <div className="mt-4 min-h-[5.5rem]">
        {checked ? (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <p className="leading-relaxed">
              {words(RECALL.feedback).slice(0, shown).map((w, i) => (
                <span key={i} className={cn("animate-in fade-in duration-150", w.b && "font-semibold")}>{w.t} </span>
              ))}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">From {RECALL.source}</p>
          </div>
        ) : (
          <div className="flex justify-end">
            <span className={cn("raised inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform duration-150", now >= pressAt - 100 && now < pressAt + 80 && "scale-95")}>
              {checking ? "Checking against your notes…" : "Check answer"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}


/* ---------- a study session: the card, the timer, and your buddy on top ---------- */

// One loop: flip a card and get it right, then type an answer and miss
const SESSION_TYPED = "oxygen";
const S = { flip: 1400, gotIt: 2700, next: 4400, typeEnd: 4900 + SESSION_TYPED.length * 90, check: 0, miss: 0, end: 0 };
S.check = S.typeEnd + 400;
S.miss = S.check + 900;
S.end = S.miss + 3600;

export function SessionDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, margin: "0px" });
  const [round, setRound] = useState(0);
  const t = useClock(inView && !reduced, round, S.end, () => setRound((r) => r + 1));
  const now = reduced ? S.gotIt + 300 : t;
  const second = now >= S.next;
  const flipped = now >= S.flip && !second;
  const typed = SESSION_TYPED.slice(0, Math.max(0, Math.floor((now - 4900) / 90)));
  const checking = now >= S.check && now < S.miss;
  const missed = now >= S.miss;
  const reaction: { face: "happy" | "flat" | "side"; line: string | null } =
    missed ? { face: "flat", line: "Not quite. Want me to explain it?" } : now >= S.gotIt && !second ? { face: "happy", line: "You got it." } : { face: "side", line: null };
  const seconds = 18 * 60 + 42 - Math.floor(now / 1000);
  const ringC = 2 * Math.PI * 13;

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl bg-card text-left shadow-2xl ring-1 ring-foreground/10 dark:shadow-black/40">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Biology</p>
          <p className="text-xs text-muted-foreground">Pomodoro, block 1</p>
        </div>
        <div className="hidden w-40 gap-1.5 sm:grid">
          <p className="text-center text-xs text-muted-foreground tabular-nums">{second ? 2 : 1} of 12</p>
          <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: second ? "9%" : "0%" }} />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <svg width={32} height={32} className="-rotate-90" aria-hidden>
            <circle cx={16} cy={16} r={13} fill="none" strokeWidth={3} className="stroke-foreground/10" />
            <circle cx={16} cy={16} r={13} fill="none" strokeWidth={3} strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={ringC * (1 - seconds / 1500)} className="stroke-primary" />
          </svg>
          <span className="text-lg font-semibold tabular-nums">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* The card, with your buddy perched on top */}
      <div className="px-5 pt-8 pb-8 sm:px-14">
        <div className="relative mx-auto max-w-xl pt-[52px]">
          <div className="absolute top-0 right-6 z-10 flex items-end gap-2">
            <p
              className={cn(
                "mb-6 flex items-center gap-2 rounded-2xl rounded-br-sm bg-card px-3 py-2 text-sm font-medium shadow-lg ring-1 ring-border transition-[opacity,transform] duration-200",
                reaction.line ? "opacity-100" : "translate-y-1 opacity-0"
              )}
            >
              {reaction.line ?? "You got it."}
              {missed && <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs text-primary-foreground">Explain it</span>}
            </p>
            <PetSprite
              key={reaction.face + (missed ? "m" : "")}
              look={DEFAULT_LOOK}
              face={reaction.face}
              book={reaction.face === "side"}
              className={cn(
                "-mb-px h-14 w-[52px] origin-bottom",
                reaction.face === "happy" && "animate-[pet-hop_400ms_ease-out]",
                reaction.face === "flat" && "animate-[pet-squash_400ms_ease-out]",
                reaction.face === "side" && !reduced && "animate-[pet-read_2.4s_ease-in-out_infinite]"
              )}
            />
          </div>

          {!second ? (
            <div className="perspective-[1200px]">
              <div className={cn("relative grid min-h-56 grid-cols-[minmax(0,1fr)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform-3d motion-reduce:transition-none", flipped && "rotate-y-180")}>
                <DemoFace label="Glycolysis" badge="Review">Where does glycolysis happen?</DemoFace>
                <DemoFace label="Answer" back source="Biology notes, lecture 3">
                  In the cytoplasm
                </DemoFace>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 rounded-[24px] border border-border/60 bg-card p-6 shadow-xl shadow-black/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Krebs cycle</span>
                <span className="rounded-full bg-foreground/5 px-2.5 py-1">Weak topic</span>
              </div>
              <p className="text-xl font-semibold tracking-tight sm:text-2xl">What does each turn of the Krebs cycle release?</p>
            </div>
          )}

          <div className="mt-5 min-h-12">
            {!second ? (
              flipped ? (
                <div className="grid grid-cols-2 gap-3 text-sm font-medium">
                  <span className="grid h-11 place-items-center rounded-lg border border-input bg-background">Again</span>
                  <span className={cn("raised grid h-11 place-items-center rounded-lg bg-primary text-primary-foreground transition-transform duration-150", now >= S.gotIt - 150 && now < S.gotIt + 100 && "scale-95")}>Got it</span>
                </div>
              ) : (
                <span className="grid h-11 place-items-center rounded-lg border border-input bg-background text-sm font-medium">Show answer</span>
              )
            ) : (
              <div className={cn("flex h-12 items-center rounded-xl border bg-background px-4 transition-colors", missed ? "border-destructive/60" : "border-input")}>
                <span className={cn("flex-1 truncate", !typed && "text-muted-foreground")}>{typed || "Your answer"}</span>
                {!missed && typed && !checking && <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-primary" />}
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">{checking ? "Checking against your notes…" : missed ? "Two CO₂ molecules" : ""}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoFace({ label, badge, back = false, source, children }: { label: string; badge?: string; back?: boolean; source?: string; children: React.ReactNode }) {
  return (
    <div className={cn("col-start-1 row-start-1 flex flex-col rounded-[24px] border border-border/60 p-6 shadow-xl shadow-black/10 backface-hidden", back ? "rotate-y-180 bg-primary/[0.06]" : "bg-card")}>
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {badge && <span className="rounded-full bg-foreground/5 px-2.5 py-1">{badge}</span>}
      </div>
      <p className="my-auto py-6 text-center text-xl font-semibold tracking-tight text-balance sm:text-2xl">{children}</p>
      {source && <span className="text-xs text-muted-foreground">From {source}</span>}
    </div>
  );
}

/* ---------- notes in, flashcards out ---------- */

const NOTE_CARDS = ["Where does glycolysis happen?", "What does the Krebs cycle release?", "What makes most of the ATP?", "What happens without oxygen?"];

export function NotesDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, margin: "0px" });
  const [round, setRound] = useState(0);
  const t = useClock(inView && !reduced, round, 7200, () => setRound((r) => r + 1));
  const now = reduced ? 6000 : t;
  const added = now >= 400;
  const reading = now >= 900 && now < 2600;
  const shown = Math.max(0, Math.min(NOTE_CARDS.length, Math.floor((now - 2600) / 350) + 1));

  return (
    <div ref={ref} className="rounded-2xl bg-card p-6 text-left shadow-xl ring-1 ring-foreground/10 dark:shadow-black/40">
      <p className="font-semibold">Biology</p>
      <p className="text-sm text-muted-foreground">Notes</p>
      <div className={cn("mt-4 flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition-all duration-300", added ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0")}>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive text-[10px] font-bold text-white">PDF</span>
        <span className="min-w-0 flex-1 truncate font-medium">Lecture 3, respiration.pdf</span>
        <span className="shrink-0 text-xs text-muted-foreground">{reading ? "Reading…" : shown ? `${NOTE_CARDS.length * 3} flashcards` : ""}</span>
      </div>
      <div className="mt-5 grid gap-2">
        {NOTE_CARDS.map((q, i) => (
          <div
            key={q}
            className={cn(
              "flex items-center gap-3 rounded-xl bg-foreground/[0.04] px-4 py-3 text-sm transition-all duration-300",
              i < shown ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"
            )}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            {q}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- the handheld, to try ---------- */

const DEMO_STATUS: StudyStatus = {
  streak: 4,
  due: 12,
  studiedToday: false,
  studiedBefore: true,
  week: { reviewed: 86, accuracy: 0.78, focusMinutes: 95, sessions: 4 },
  weekDays: [true, true, false, true, true, true, false],
};

/** Mochi's handheld, playable: the arrows and A choose, B pets it. */
export function HandheldDemo() {
  // It reads the clock for its window, so it renders in the browser only
  const hydrated = useHydrated();
  const [note, setNote] = useState<string | null>(null);
  const tell = (text: string) => {
    setNote(text);
    setTimeout(() => setNote((n) => (n === text ? null : n)), 2200);
  };
  return (
    <div className="grid justify-items-center gap-3">
      {!hydrated ? (
        <div className="aspect-[72/100] w-full max-w-[468px]" aria-hidden />
      ) : (
      <PetDevice
        pet={{ ...DEFAULT_LOOK, species: "cat", name: "Mochi", xp: 150 }}
        status={DEMO_STATUS}
        studyLabel="Biology"
        autoFocus={false}
        onEdit={() => tell("In the app, Edit lets you pick its look and name.")}
        onStudy={() => tell("In the app, this starts a Biology session.")}
        onToday={() => tell("In the app, this opens your plan for today.")}
      />
      )}
      <p className={cn("min-h-5 text-sm text-muted-foreground transition-opacity duration-200", note ? "opacity-100" : "opacity-0")}>{note ?? " "}</p>
    </div>
  );
}

/* ---------- explain it, then explain it back ---------- */

const EXPLAIN = {
  q: "What does each turn of the Krebs cycle release?",
  idea: "Each turn breaks down carbon compounds, so it gives off two carbon dioxide molecules, and loads NADH and FADH2 with electrons for the next stage.",
  typed: "It breaks carbon down and gives off two CO2, plus NADH and FADH2.",
};

export function ExplainDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, margin: "0px" });
  const [round, setRound] = useState(0);
  const ideaAt = 600;
  const typeAt = 3200;
  const checkAt = typeAt + EXPLAIN.typed.length * 40 + 500;
  const t = useClock(inView && !reduced, round, checkAt + 4000, () => setRound((r) => r + 1));
  const now = reduced ? checkAt + 500 : t;
  const shown = Math.max(0, Math.floor((now - ideaAt) / 30));
  const typed = EXPLAIN.typed.slice(0, Math.max(0, Math.floor((now - typeAt) / 40)));
  const checked = now >= checkAt;
  return (
    <div ref={ref} className="rounded-2xl bg-card p-6 text-left shadow-xl ring-1 ring-foreground/10 dark:shadow-black/40">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Krebs cycle</span>
        <span className="rounded-full bg-foreground/5 px-2.5 py-1">Follow-up</span>
      </div>
      <p className="mt-3 text-lg font-semibold">{EXPLAIN.q}</p>
      <div className="mt-4 rounded-xl bg-primary/[0.07] p-4">
        <p className="text-xs font-medium text-primary">Here&apos;s the idea</p>
        <p className="mt-1 min-h-[4.5rem] text-sm leading-relaxed">{EXPLAIN.idea.slice(0, shown)}</p>
      </div>
      <p className="mt-4 text-sm font-medium">Now explain it back in your own words</p>
      <div className={cn("mt-2 min-h-16 rounded-xl border bg-background p-3 text-sm transition-colors", checked ? "border-success/60" : "border-input")}>
        {typed || <span className="text-muted-foreground">As if you were teaching a friend</span>}
        {!checked && typed && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />}
      </div>
      <p className={cn("mt-3 flex items-start gap-2 text-sm transition-opacity duration-300", checked ? "opacity-100" : "opacity-0")}>
        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-success text-[10px] text-white">✓</span>
        You got the carbon dioxide and the electron carriers. That&apos;s the idea.
      </p>
    </div>
  );
}

/* ---------- a practice exam, marked ---------- */

const EXAM_TOPICS: [string, number, number][] = [
  ["Glycolysis", 4, 4],
  ["Krebs cycle", 3, 4],
  ["Electron transport chain", 2, 3],
  ["Fermentation", 1, 3],
];

export function ExamDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, margin: "0px" });
  const t = useClock(inView && !reduced, "exam", 2400);
  const p = reduced ? 1 : Math.min(1, t / 1400);
  const score = Math.round(71 * p);
  return (
    <div ref={ref} className="rounded-2xl bg-card p-6 text-left shadow-xl ring-1 ring-foreground/10 dark:shadow-black/40">
      <p className="text-sm text-muted-foreground">Practice exam: Biology</p>
      <div className="mt-1 flex items-end justify-between gap-4">
        <p className="text-5xl font-bold tracking-tight tabular-nums">{score}%</p>
        <p className="pb-1 text-sm text-muted-foreground">10 of 14 right in 12:40</p>
      </div>
      <div className="mt-6 grid gap-3.5">
        {EXAM_TOPICS.map(([topic, right, total], i) => {
          const share = right / total;
          return (
            <div key={topic} className="grid gap-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{topic}</span>
                <span className="text-muted-foreground tabular-nums">
                  {right} of {total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-700 ease-out", share >= 0.7 ? "bg-success" : share >= 0.4 ? "bg-amber-500" : "bg-destructive")}
                  style={{ width: `${Math.max(4, share * 100 * Math.min(1, Math.max(0, (p * 1.4 - i * 0.1))))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <span className="raised mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Study the 4 you missed</span>
    </div>
  );
}

/* ---------- your own study music ---------- */

const TRACKS = ["Rain on a window", "Lo-fi for Biology", "Forest at dawn", "Late night piano"];

export function MusicDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, margin: "0px" });
  const t = useClock(inView && !reduced, "music");
  const playing = Math.floor((reduced ? 0 : t) / 3200) % TRACKS.length;
  return (
    <div ref={ref} className="relative rounded-2xl bg-card p-6 pb-20 text-left shadow-xl ring-1 ring-foreground/10 dark:shadow-black/40">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Rainy focus</p>
        <span className="text-sm text-muted-foreground">{TRACKS.length} songs</span>
      </div>
      <ol className="mt-4 grid gap-1">
        {TRACKS.map((name, i) => (
          <li key={name} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-300", i === playing ? "bg-primary/10 font-medium text-primary" : "")}>
            <span className="w-4 text-center text-muted-foreground tabular-nums">{i === playing ? "♪" : i + 1}</span>
            <span className="flex-1">{name}</span>
          </li>
        ))}
      </ol>
      {/* The floating player, as it sits over every page */}
      <div className="absolute right-4 bottom-4 left-4 flex items-center gap-3 rounded-full bg-background/90 py-2 pr-3 pl-2 shadow-lg ring-1 ring-foreground/10 sm:left-auto">
        <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
          <span className={cn("text-sm", !reduced && "animate-[spin_4s_linear_infinite]")}>♪</span>
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{TRACKS[playing]}</span>
        <span className="text-xs text-muted-foreground">Keeps playing</span>
      </div>
    </div>
  );
}

/* ---------- today: what to study, and your goal ---------- */

export function TodayDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, margin: "0px" });
  const t = useClock(inView && !reduced, "today", 2000);
  const p = reduced ? 1 : Math.min(1, t / 1600);
  const done = Math.round(14 * p);
  return (
    <div ref={ref} className="rounded-2xl bg-card p-6 text-left shadow-xl ring-1 ring-foreground/10 dark:shadow-black/40">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-[4.5rem] shrink-0 place-items-end justify-center overflow-hidden rounded-2xl bg-[#e7effc] pb-2 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
          <PetSprite look={DEFAULT_LOOK} face="side" book className="h-11 w-[42px]" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold">Good evening</p>
          <p className="text-sm text-muted-foreground">Mochi suggests Biology: 12 to review, and Fermentation needs work.</p>
        </div>
      </div>
      <span className="raised mt-5 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Start with Biology</span>
      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Today&apos;s goal</p>
          <p className="mt-0.5 font-semibold tabular-nums">{done} of 20 cards</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(done / 20) * 100}%` }} />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Streak</p>
          <p className="mt-0.5 font-semibold">5 days</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Focus this week</p>
          <p className="mt-0.5 font-semibold">2h 10m</p>
        </div>
      </div>
    </div>
  );
}
