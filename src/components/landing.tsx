"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, FileText, Play, Search } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/*
 * The landing page's moving parts, drawn from the app's own tokens and classes
 * (.cite, glass, the highlight colours) so they follow the theme. Everything
 * settles to its final state when the visitor prefers reduced motion.
 */

const BRACKET =
  "M16 3c-5 .5-9 0-11.5.8C3.4 20 4.6 50 3.6 70c-.3 9 .6 18 .2 26 3.6.8 8 .2 12.2.6l.4-5c-2.6-.4-5.2 0-7.6-.4.5-8-.3-17 .1-25 .6-19-.3-42 .4-58 2.4-.4 5 .1 7.2-.3z";

/* ---------- hooks ---------- */

const REDUCED = "(prefers-reduced-motion: reduce)";
function useReducedMotion() {
  return useSyncExternalStore(
    (on) => {
      const q = window.matchMedia(REDUCED);
      q.addEventListener("change", on);
      return () => q.removeEventListener("change", on);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

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

/* ---------- the hero: ask, and the answer lands in the margin ---------- */

const EXAMPLES = [
  {
    id: "handbook",
    label: "Handbook",
    meta: "Employee handbook, page 31",
    title: "8.3 Annual leave",
    paras: [
      "Full-time employees receive 15 days of paid annual leave a year, credited monthly.",
      "Up to 5 unused days roll over to the next year. Anything above that is forfeited on 31 December.",
      "Leave requests should be made at least 10 working days in advance.",
      "Unpaid leave can be agreed with your manager for up to three months.",
    ],
    q: "Does unused leave carry over?",
    a: "Yes. Up to **5 unused days** roll over to next year.",
    hand: "“roll over” = “carry over” ✓",
  },
  {
    id: "lease",
    label: "Lease",
    meta: "Lease agreement, page 6",
    title: "12. Pets",
    paras: [
      "The tenant keeps the property clean and free of damage.",
      "Pets are allowed with the landlord's written permission and a $300 deposit.",
      "Smoking is not allowed anywhere on the property.",
      "Guests may stay for up to 14 nights in a row.",
    ],
    q: "Can I have a cat?",
    a: "Yes, with **written permission** and a $300 deposit.",
    hand: "a cat counts as a pet ✓",
  },
  {
    id: "lecture",
    label: "Lecture notes",
    meta: "ECON 101, lecture 4",
    title: "Why prices rise",
    paras: [
      "Prices rise when demand outpaces what an economy can produce.",
      "Inflation is mostly too much money chasing too few goods.",
      "Rising costs, like wages and energy, can push prices up too.",
      "Central banks raise interest rates to slow it down.",
    ],
    q: "What causes inflation?",
    a: "Mostly **too much money chasing too few goods.**",
    hand: "exam answer ✓",
  },
] as const;
const TARGET = 1;

export function LiveDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, margin: "0px" });
  const [i, setI] = useState(0);
  const [round, setRound] = useState(0);
  const [hoverCite, setHoverCite] = useState(false);
  const ex = EXAMPLES[i];

  const typeEnd = 250 + ex.q.length * 30;
  const sendAt = typeEnd + 150;
  const markAt = sendAt + 200;
  const noteAt = sendAt + 380;
  const nWords = words(ex.a).length;
  const doneAt = noteAt + nWords * 45 + 100;
  const endAt = doneAt + 3600;
  const t = useClock(inView && !hoverCite, `${i}-${round}`, endAt, () => {
    setI((x) => (x + 1) % EXAMPLES.length);
    setRound((r) => r + 1);
  });
  const now = reduced ? doneAt + 1 : t;

  const typed = ex.q.slice(0, Math.max(0, Math.floor((now - 250) / 30)));
  const sent = now >= sendAt;
  const pressed = now >= sendAt - 90 && now < sendAt + 60;
  const marked = now >= markAt;
  const noteIn = now >= noteAt;
  const shown = Math.max(0, Math.floor((now - noteAt) / 45));
  const done = now >= doneAt;
  const progress = Math.min(1, now / endAt);

  return (
    <div ref={ref}>
      <div className="mb-4 flex justify-center">
        <ToggleGroup
          type="single"
          value={ex.id}
          onValueChange={(v) => {
            const n = EXAMPLES.findIndex((e) => e.id === v);
            if (n >= 0) { setI(n); setRound((r) => r + 1); }
          }}
          variant="outline"
          className="glass rounded-lg border border-glass-border bg-glass p-1"
          aria-label="Example document"
        >
          {EXAMPLES.map((e) => (
            <ToggleGroupItem key={e.id} value={e.id} className="relative overflow-hidden rounded-md border-0 px-3 data-[state=on]:bg-card data-[state=on]:shadow-sm">
              {e.label}
              {e.id === ex.id && !reduced && (
                <span className="absolute inset-x-2 bottom-0.5 h-0.5 origin-left rounded-full bg-primary/60" style={{ transform: `scaleX(${progress})` }} />
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="glass rounded-2xl border border-glass-border bg-glass p-2 sm:p-3">
        <div key={ex.id} className="relative overflow-hidden rounded-xl bg-card p-6 pb-28 text-left ring-1 ring-foreground/10 animate-in fade-in duration-200 sm:p-10 sm:pb-32 lg:min-h-[27rem]">
          <div className="lg:max-w-[60%]">
            <p className="text-xs text-muted-foreground sm:text-sm">{ex.meta}</p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{ex.title}</h3>
            {ex.paras.map((p, n) =>
              n === TARGET ? (
                <p key={n} className={cn("relative mt-4 ml-5 leading-relaxed transition-transform duration-150 sm:ml-0", hoverCite && "scale-[1.02]")}>
                  <MarginBracket drawn={marked} />
                  <Marked on={marked} bright={hoverCite}>{p}</Marked>
                </p>
              ) : (
                <p key={n} className={cn("mt-4 leading-relaxed text-muted-foreground transition-opacity duration-300", n === 3 && "hidden sm:block", marked && "opacity-60")}>{p}</p>
              ),
            )}
          </div>

          {noteIn && (
            <div className="mt-6 animate-in fade-in zoom-in-90 slide-in-from-right-6 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:absolute lg:top-[8.5rem] lg:right-8 lg:mt-0 lg:w-[22rem]">
              <AnswerNote question={ex.q} answer={ex.a} shown={shown} cited={done} source={ex.meta} onCite={setHoverCite} />
              {done && (
                <p
                  className="mt-4 -rotate-3 font-hand text-2xl text-primary [clip-path:inset(-20%_0_-20%_0)] animate-in fade-in slide-in-from-left-3 duration-300"
                >
                  {ex.hand}
                </p>
              )}
            </div>
          )}

          {/* The composer */}
          <div className="glass absolute inset-x-4 bottom-4 flex h-14 items-center gap-3 rounded-xl border border-glass-border bg-glass pr-2 pl-4 sm:inset-x-8 sm:bottom-6">
            <span className={cn("flex-1 truncate", !sent && typed ? "text-foreground" : "text-muted-foreground")}>
              {!sent && typed ? typed : "Ask about your documents"}
              {!sent && typed && <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-primary" />}
            </span>
            <span className={cn("raised grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground transition-transform duration-150", pressed && "scale-90")}>
              <ArrowUp className="size-5" />
            </span>
          </div>
        </div>
      </div>
      {done && !reduced && <p className="mt-3 text-center text-sm text-muted-foreground animate-in fade-in duration-300">Hover the <span className="cite" data-active>1</span> to see where it came from.</p>}
    </div>
  );
}

/* ---------- search vs ask: a find bar you can type into ---------- */

const PASSAGE = "Up to 5 unused days roll over to the next year. Anything above that is forfeited on 31 December. Leave requests should be made at least 10 working days in advance.";

export function FindPlayground() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [query, setQuery] = useState("");
  const [touched, setTouched] = useState(false);
  const [shake, setShake] = useState(0);

  // Types "carry over" by itself the first time it's seen
  useEffect(() => {
    if (!inView || touched || reduced) return;
    const target = "carry over";
    let n = 0;
    const id = setInterval(() => {
      n++;
      setQuery(target.slice(0, n));
      if (n >= target.length) { clearInterval(id); setShake((s) => s + 1); }
    }, 60);
    return () => clearInterval(id);
  }, [inView, touched, reduced]);

  // With reduced motion the search is just filled in
  const q = (!touched && reduced && inView ? "carry over" : query).trim().toLowerCase();
  const hits = q ? PASSAGE.toLowerCase().split(q).length - 1 : 0;
  const parts = q ? PASSAGE.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i")) : [PASSAGE];

  return (
    <div ref={ref} className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <p className="text-sm font-medium text-muted-foreground">Find in page</p>
      <label
        key={shake}
        className={cn(
          "mt-4 flex items-center gap-3 rounded-lg border-2 bg-background px-4 py-3 transition-colors",
          q && hits === 0 ? "animate-[shake_.4s_ease-in-out] border-destructive" : "border-primary",
        )}
      >
        <Search className="size-4 text-muted-foreground" />
        <input
          value={!touched && reduced && inView ? "carry over" : query}
          onChange={(e) => { setTouched(true); setQuery(e.target.value); }}
          onFocus={() => setTouched(true)}
          className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-muted-foreground"
          placeholder="Type to search"
          aria-label="Find in page"
        />
        <span className={cn("text-sm font-semibold tabular-nums", hits ? "text-primary" : "text-destructive")}>
          {q ? `${hits} result${hits === 1 ? "" : "s"}` : ""}
        </span>
      </label>
      <p className="mt-5 leading-relaxed text-muted-foreground">
        {parts.map((p, i) => (p.toLowerCase() === q && q ? <mark key={i} className="mark" data-active="true">{p}</mark> : <span key={i}>{p}</span>))}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Exact words only. {q && !hits ? <>Try <button type="button" className="link" onClick={() => { setTouched(true); setQuery("roll over"); }}>roll over</button>.</> : "Now ask it the way you'd ask a person."}
      </p>
    </div>
  );
}

/** Marginalia's side: the answer streams in when it scrolls into view. */
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

/* ---------- how it works: connected steps that light up in turn ---------- */

export function Steps({ steps }: { steps: { icon: React.ReactNode; title: string; body: string }[] }) {
  const [ref, inView] = useInView<HTMLOListElement>();
  return (
    <div className="glass mt-10 rounded-2xl border border-glass-border bg-glass p-6 sm:p-10">
      <ol ref={ref} className="relative grid gap-8 md:grid-cols-3 md:gap-6">
        {/* The track, and the line that fills along it: down the left on phones, across on desktop */}
        <span aria-hidden className="absolute top-5 bottom-5 left-5 w-px bg-border md:right-[16.67%] md:bottom-auto md:left-[16.67%] md:h-px md:w-auto" />
        <span
          aria-hidden
          className={cn(
            "absolute top-5 bottom-5 left-5 w-px origin-top bg-primary transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none md:right-[16.67%] md:bottom-auto md:left-[16.67%] md:h-px md:w-auto md:origin-left",
            inView ? "scale-100" : "scale-y-0 md:scale-x-0 md:scale-y-100",
          )}
        />
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-5 md:flex-col md:items-center md:text-center">
            <span
              className={cn(
                "relative grid size-10 shrink-0 place-items-center rounded-full ring-1 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none [&_svg]:size-5",
                inView ? "scale-100 bg-primary text-primary-foreground ring-primary" : "scale-75 bg-card text-muted-foreground ring-border",
              )}
              style={{ transitionDelay: `${150 + i * 220}ms` }}
            >
              {s.icon}
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Step {i + 1}</p>
              <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-muted-foreground md:mx-auto md:max-w-56">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- the tour video, with a glass play button ---------- */

export function Tour() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="glass relative rounded-2xl border border-glass-border bg-glass p-2 sm:p-3">
      <video
        ref={ref}
        src="/marginalia-promo.mp4"
        poster="/marginalia-promo.jpg"
        controls={playing}
        playsInline
        preload="none"
        onPlay={() => setPlaying(true)}
        className="aspect-video w-full rounded-xl bg-card"
      />
      {!playing && (
        <button
          type="button"
          onClick={() => ref.current?.play()}
          className="group/play absolute inset-0 grid place-items-center rounded-2xl"
          aria-label="Play the tour"
        >
          <span className="glass flex items-center gap-3 rounded-full border border-glass-border bg-glass-strong py-3 pr-6 pl-3 font-medium transition-transform duration-150 group-hover/play:scale-105 group-active/play:scale-95">
            <span className="raised grid size-11 place-items-center rounded-full bg-primary text-primary-foreground">
              <Play className="size-5 translate-x-px fill-current" />
            </span>
            Play the tour
          </span>
        </button>
      )}
    </div>
  );
}

/* ---------- the wordmark, its brackets opening as it comes into view ---------- */

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
