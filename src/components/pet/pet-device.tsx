"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3Icon, CookieIcon, MoonIcon, PaletteIcon, ToyBrickIcon } from "lucide-react";
import { carePet } from "@/app/actions/pet";
import { palette } from "@/lib/pet-art";
import { petMood, petStats } from "@/lib/pet-care";
import { onPetSignal } from "@/lib/pet-events";
import { playPetSound } from "@/lib/pet-sounds";
import type { Pet } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PetSprite, type Face } from "./pet-sprite";

/*
 * The pet's handheld: an egg-shaped shell in its colour, a screen with its
 * little room, and ◀ ▶ A B buttons. ◀ ▶ pick from the menu, A does it, B goes
 * back. The keyboard works too (arrow keys, Enter or Z for A, X or Backspace
 * for B), and everything on the screen can be tapped.
 *
 * The room is drawn in art pixels on a 48×36 grid; the window shows the real
 * time of day.
 */

const RW = 48;
const RH = 36;
const FLOOR = 31; // where the pet's feet rest
const MENU = [
  { id: "feed", label: "Feed", icon: CookieIcon },
  { id: "play", label: "Play", icon: ToyBrickIcon },
  { id: "sleep", label: "Sleep", icon: MoonIcon },
  { id: "stats", label: "Stats", icon: BarChart3Icon },
  { id: "edit", label: "Edit", icon: PaletteIcon },
] as const;
type MenuId = (typeof MENU)[number]["id"];
type Screen = "home" | "stats" | "game" | "sleep";
type Reaction = "found" | "shrug" | "eat" | "pet" | "wake";

export function PetDevice({ pet, onEdit }: { pet: Pet; onEdit: () => void }) {
  const reduced = useReducedMotion();
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<Screen>("home");
  const [selected, setSelected] = useState(0);
  const [x, setX] = useState(16);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [reaction, setReaction] = useState<{ kind: Reaction; seq: number } | null>(null);
  const [face, setFace] = useState<Face | null>(null);
  const [blink, setBlink] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [cookie, setCookie] = useState(0);
  const [reading, setReading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const stats = petStats(pet, now);
  const mood = petMood(pet, now);
  const asleep = screen === "sleep";

  const say = (text: string, ms = 2200) => {
    setBubble(text);
    later(() => setBubble((b) => (b === text ? null : b)), ms);
  };
  const react = (kind: Reaction, hold?: Face, ms = 900) => {
    setReaction((r) => ({ kind, seq: (r?.seq ?? 0) + 1 }));
    playPetSound(kind, pet.species);
    if (hold) {
      setFace(hold);
      later(() => setFace(null), ms);
    }
  };
  const care = (kind: "feed" | "play" | "sleep", xp: number) => {
    const at = new Date().toISOString();
    const key = { feed: "fedAt", play: "playedAt", sleep: "sleptAt" } as const;
    queryClient.setQueryData<Pet | null>(["pet"], (p) => (p ? { ...p, [key[kind]]: at, xp: p.xp + xp } : p));
    void carePet(kind, xp);
  };

  // Clock for the needs and the window; blinking; wandering about the room
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    const blinker = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3800);
    return () => {
      clearInterval(clock);
      clearInterval(blinker);
    };
  }, []);
  useEffect(() => {
    if (screen !== "home" || reduced || reading) return;
    const wander = setInterval(() => {
      setX((cur) => {
        const next = Math.max(4, Math.min(RW - 20, cur + (Math.random() < 0.5 ? -1 : 1) * (2 + Math.floor(Math.random() * 6))));
        setFacing(next >= cur ? 1 : -1);
        return next;
      });
    }, 1700);
    return () => clearInterval(wander);
  }, [screen, reduced, reading]);

  // Says hi, and keeps an eye on what you're doing in the app
  useEffect(() => {
    const hi = setTimeout(() => {
      setBubble(mood === "Happy" ? `Hi! I'm ${pet.name}.` : `${pet.name} is ${mood.toLowerCase()}.`);
      playPetSound("hi", pet.species);
    }, 350);
    const off = onPetSignal((s) => {
      if (s.kind === "reading") {
        setReading(true);
        setBubble("Reading along…");
      } else if (s.kind === "found") {
        setReading(false);
        react("found", "happy", 1400);
        say("Found it! +5 XP");
      } else if (s.kind === "shrug") {
        setReading(false);
        react("shrug", "flat", 1400);
        say("Not in your files.");
      } else if (s.kind === "eat") {
        react("eat", "chomp", 700);
        say(`Mm, a ${s.label}. +3 XP`);
      }
    });
    return () => {
      clearTimeout(hi);
      off();
    };
    // Once when the screen turns on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- buttons ---------- */

  const run = (id: MenuId) => {
    playPetSound("pet", pet.species);
    if (id === "feed") {
      if (stats.hunger > 95) return say("I'm full!");
      setCookie((c) => c + 1);
      later(() => {
        react("eat", "chomp", 700);
        say("Yum! +1 XP");
      }, 450);
      care("feed", 1);
    } else if (id === "play") {
      setScreen("game");
    } else if (id === "sleep") {
      setScreen("sleep");
      setBubble(null);
      playPetSound("nap", pet.species);
      care("sleep", 1);
    } else if (id === "stats") {
      setScreen("stats");
    } else if (id === "edit") {
      onEdit();
    }
  };
  const game = useCatchGame(screen === "game", (won, score) => {
    care("play", won ? 4 : 1);
    say(won ? `You won! +4 XP` : `${score} caught. +1 XP`, 2600);
    if (won) react("found", "happy", 1400);
    setScreen("home");
  }, pet);

  const press = (button: "left" | "right" | "a" | "b") => {
    if (screen === "game") return game.press(button, () => setScreen("home"));
    if (screen === "sleep") {
      if (button === "a" || button === "b") {
        setScreen("home");
        react("wake");
        say("Morning!");
      }
      return;
    }
    if (screen === "stats") {
      if (button === "b" || button === "a") setScreen("home");
      return;
    }
    if (button === "left") setSelected((s) => (s + MENU.length - 1) % MENU.length);
    if (button === "right") setSelected((s) => (s + 1) % MENU.length);
    if (button === "a") run(MENU[selected].id);
    if (button === "b") {
      react("pet", "happy", 800);
      say("♥");
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, "left" | "right" | "a" | "b"> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      Enter: "a",
      z: "a",
      " ": "a",
      x: "b",
      Backspace: "b",
    };
    const b = map[e.key];
    if (!b) return;
    e.preventDefault();
    press(b);
  };

  const colors = palette(pet.color);
  const hour = new Date(now).getHours();

  return (
    <div className="mx-auto w-full max-w-[340px] select-none" onKeyDown={onKey}>
      {/* The shell */}
      <div
        className="relative rounded-[48%_48%_42%_42%/30%_30%_34%_34%] px-7 pt-9 pb-9 shadow-[inset_0_-10px_24px_rgb(0_0_0/0.18),inset_0_8px_18px_rgb(255_255_255/0.45),0_24px_40px_-18px_rgb(1_40_110/0.45)]"
        style={{ background: `radial-gradient(120% 90% at 30% 15%, ${colors.L}, ${pet.color} 55%, ${colors.D})` }}
      >
        <div aria-hidden className="pointer-events-none absolute top-5 left-10 h-10 w-20 -rotate-12 rounded-full bg-white/35 blur-md" />
        <p className="mb-3 text-center font-serif text-sm font-semibold tracking-wide text-white/90 [text-shadow:0_1px_0_rgb(0_0_0/0.25)]">
          [ {pet.name} ]
        </p>

        {/* Screen */}
        <div className="rounded-2xl bg-[#1d2433] p-2.5 shadow-[inset_0_2px_6px_rgb(0_0_0/0.6)]">
          <div
            tabIndex={0}
            role="application"
            aria-label={`${pet.name}'s screen. ${mood}. Use the arrow keys to choose, Enter for A, X for B.`}
            className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#e7effc] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          >
            {screen === "stats" ? (
              <Stats pet={pet} stats={stats} mood={mood} />
            ) : (
              <svg viewBox={`0 0 ${RW} ${RH}`} shapeRendering="crispEdges" className="absolute inset-0 size-full" aria-hidden>
                <Room hour={hour} dark={asleep} />
                {screen === "game" ? (
                  game.scene()
                ) : (
                  <>
                    {cookie > 0 && (
                      <motion.g key={cookie} initial={{ y: -12, opacity: 1 }} animate={{ y: FLOOR - 4, opacity: [1, 1, 0] }} transition={{ duration: 0.45, ease: "easeIn" }}>
                        <rect x={x + 7} y={0} width={3} height={2} fill="#c7893b" />
                        <rect x={x + 8} y={0} width={1} height={1} fill="#5b3a1a" />
                      </motion.g>
                    )}
                    <motion.g animate={{ x }} transition={{ duration: reduced ? 0 : 0.9, ease: "linear" }}>
                      <motion.g
                        key={reaction?.seq ?? 0}
                        animate={reaction && !reduced ? MOVES[reaction.kind] : undefined}
                        style={{ originX: "8px", originY: `${FLOOR}px` }}
                        onClick={() => {
                          if (screen !== "home") return;
                          react("pet", "happy", 800);
                          say("♥");
                        }}
                        className="cursor-pointer"
                      >
                        <g transform={`translate(0 ${FLOOR - 14}) ${facing === -1 ? "translate(16 0) scale(-1 1)" : ""}`}>
                          <PetSprite look={pet} face={asleep ? "closed" : face ?? (reading ? "side" : blink ? "closed" : "open")} book={reading} bare />
                        </g>
                      </motion.g>
                    </motion.g>
                    {asleep && !reduced && <Zzz x={x + 14} />}
                  </>
                )}
              </svg>
            )}

            {/* Status line */}
            {screen !== "stats" && (
              <div className="absolute inset-x-0 top-0 flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-[#1d2433]">
                <span className="rounded bg-white/70 px-1.5 py-0.5">Lv {stats.level}</span>
                {screen === "game" ? (
                  <span className="rounded bg-white/70 px-1.5 py-0.5 tabular-nums">
                    {game.score} / {GOAL} · misses {game.misses}/3
                  </span>
                ) : (
                  <span className="rounded bg-white/70 px-1.5 py-0.5">{asleep ? "Sleeping" : mood}</span>
                )}
              </div>
            )}

            {bubble && screen !== "stats" && (
              <p className="absolute top-7 left-1/2 max-w-[90%] -translate-x-1/2 truncate rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#1d2433] shadow animate-in fade-in zoom-in-95 duration-150">
                {bubble}
              </p>
            )}
            {screen === "game" && !game.running && (
              <p className="absolute inset-x-0 bottom-3 text-center text-[11px] font-semibold text-[#1d2433]">
                <span className="rounded bg-white/80 px-2 py-0.5">Catch {GOAL} books · A to start</span>
              </p>
            )}
          </div>

          {/* Menu icons */}
          <div className="mt-2 grid grid-cols-5 gap-1">
            {MENU.map((m, i) => {
              const Icon = m.icon;
              const on = screen === "home" && i === selected;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-label={m.label}
                  onClick={() => {
                    setSelected(i);
                    if (screen === "home") run(m.id);
                  }}
                  disabled={screen !== "home"}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-md py-1 text-[10px] font-medium transition-colors duration-150 disabled:opacity-40",
                    on ? "bg-[#e7effc] text-[#1d2433]" : "text-white/70 hover:text-white"
                  )}
                >
                  <Icon className="size-4" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex items-center justify-between px-1">
          <div className="flex gap-2">
            <ShellButton label="Left" onPress={() => press("left")}>◀</ShellButton>
            <ShellButton label="Right" onPress={() => press("right")}>▶</ShellButton>
          </div>
          <div className="flex items-end gap-3">
            <ShellButton label="B, back" onPress={() => press("b")} round tone="b">B</ShellButton>
            <ShellButton label="A, choose" onPress={() => press("a")} round tone="a" className="-translate-y-2">A</ShellButton>
          </div>
        </div>
      </div>
    </div>
  );
}

const MOVES = {
  found: { y: [0, -8, 0, -3, 0], transition: { duration: 0.7 } },
  shrug: { rotate: [0, -8, 8, -4, 0], transition: { duration: 0.6 } },
  eat: { scaleX: [1, 1.15, 0.92, 1.08, 1], scaleY: [1, 0.85, 1.08, 0.92, 1], transition: { duration: 0.6 } },
  pet: { scaleX: [1, 1.12, 0.95, 1], scaleY: [1, 0.82, 1.1, 1], transition: { duration: 0.45 } },
  wake: { scaleY: [1, 1.15, 1], transition: { duration: 0.5 } },
};

function ShellButton({ label, onPress, round, tone, className, children }: { label: string; onPress: () => void; round?: boolean; tone?: "a" | "b"; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className={cn(
        "grid place-items-center font-bold text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.25),inset_0_2px_0_rgb(255_255_255/0.35),0_3px_6px_rgb(0_0_0/0.25)] transition-transform duration-75 active:translate-y-0.5 active:shadow-[inset_0_-1px_0_rgb(0_0_0/0.25),0_1px_2px_rgb(0_0_0/0.25)]",
        round ? "size-12 rounded-full text-base" : "h-10 w-11 rounded-xl text-sm",
        tone === "a" ? "bg-[#df2224]" : tone === "b" ? "bg-[#facc15] text-[#3b2f06]" : "bg-[#1d2433]",
        className
      )}
    >
      {children}
    </button>
  );
}

/* ---------- the room ---------- */

function Room({ hour, dark }: { hour: number; dark: boolean }) {
  const night = hour < 6 || hour >= 19;
  const dusk = !night && (hour >= 17 || hour < 7);
  const sky = night ? "#1b2a4a" : dusk ? "#f6a87a" : "#9fd3ff";
  const books = ["#df2224", "#0152cb", "#22c55e", "#f5a524", "#8b5cf6", "#0152cb", "#f472b6", "#22c55e"];
  return (
    <g>
      {/* Wall and floor */}
      <rect width={RW} height={26} fill="#e7effc" />
      <rect y={24} width={RW} height={1} fill="#c9d6ef" />
      <rect y={25} width={RW} height={11} fill="#d9b98a" />
      {[0, 8, 16, 24, 32, 40].map((px) => (
        <rect key={px} x={px} y={25} width={1} height={11} fill="#c49e6b" />
      ))}
      <rect y={30} width={RW} height={1} fill="#c49e6b" />
      {/* Window, showing the time of day */}
      <rect x={30} y={4} width={13} height={11} fill="#ffffff" />
      <rect x={31} y={5} width={11} height={9} fill={sky} />
      {night ? (
        <>
          <rect x={38} y={6} width={2} height={2} fill="#fdf6c3" />
          <rect x={33} y={7} width={1} height={1} fill="#ffffff" />
          <rect x={35} y={11} width={1} height={1} fill="#ffffff" />
        </>
      ) : (
        <rect x={37} y={6} width={3} height={3} fill={dusk ? "#ffdf8a" : "#ffd23f"} />
      )}
      <rect x={36} y={5} width={1} height={9} fill="#ffffff" />
      <rect x={31} y={9} width={11} height={1} fill="#ffffff" />
      {/* Bookshelf */}
      <rect x={3} y={8} width={13} height={17} fill="#8a5a3b" />
      {[9, 14, 19].map((y, row) => (
        <g key={y}>
          <rect x={4} y={y} width={11} height={4} fill="#6d4429" />
          {books.slice(row * 2, row * 2 + 4).map((c, i) => (
            <rect key={i} x={5 + i * 2.5} y={y + (i % 2)} width={2} height={4 - (i % 2)} fill={c} />
          ))}
        </g>
      ))}
      {/* Plant */}
      <rect x={43} y={21} width={4} height={4} fill="#c4643b" />
      <rect x={44} y={17} width={2} height={4} fill="#22c55e" />
      <rect x={42} y={18} width={2} height={2} fill="#16a34a" />
      <rect x={46} y={16} width={2} height={2} fill="#16a34a" />
      {/* Rug */}
      <rect x={10} y={32} width={28} height={3} fill="#4d9cff" />
      <rect x={11} y={33} width={26} height={1} fill="#9cc7ff" />
      {/* Lights out */}
      {dark && <rect width={RW} height={RH} fill="#0b1220" opacity={0.55} />}
    </g>
  );
}

function Zzz({ x }: { x: number }) {
  return (
    <g fill="#e7effc" fontSize={4} fontFamily="monospace" fontWeight={700}>
      {[0, 1, 2].map((i) => (
        <motion.text key={i} x={x} y={FLOOR - 14} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0], x: [x, x + 3 + i], y: [FLOOR - 14, FLOOR - 22 - i * 2] }} transition={{ duration: 2.4, delay: i * 0.8, repeat: Infinity }}>
          z
        </motion.text>
      ))}
    </g>
  );
}

/* ---------- stats ---------- */

function Stats({ pet, stats, mood }: { pet: Pet; stats: ReturnType<typeof petStats>; mood: string }) {
  const rows: [string, number][] = [
    ["Hunger", stats.hunger],
    ["Happy", stats.happy],
    ["Energy", stats.energy],
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2 bg-[#e7effc] px-4 text-[#1d2433]">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold">{pet.name}</p>
        <p className="text-[11px] font-medium">{mood}</p>
      </div>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center gap-2 text-[11px] font-medium">
          <span className="w-12">{label}</span>
          <span className="flex gap-0.5" aria-label={`${label} ${value} out of 100`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <svg key={i} viewBox="0 0 7 6" shapeRendering="crispEdges" className="h-3 w-3.5" aria-hidden>
                <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" fill={value > i * 20 + 10 ? "#df2224" : "#1d243333"} />
              </svg>
            ))}
          </span>
        </div>
      ))}
      <div className="text-[11px] font-medium">
        <div className="flex justify-between">
          <span>Level {stats.level}</span>
          <span className="tabular-nums">{pet.xp} XP</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#1d243322]">
          <div className="h-full bg-primary" style={{ width: `${Math.round(stats.progress * 100)}%` }} />
        </div>
      </div>
      <p className="text-center text-[10px] opacity-70">Ask questions and upload files to earn XP · B to go back</p>
    </div>
  );
}

/* ---------- play: catch the falling books ---------- */

const GOAL = 8;
const LANES = [10, 20, 30];

function useCatchGame(active: boolean, onEnd: (won: boolean, score: number) => void, pet: Pet) {
  const [running, setRunning] = useState(false);
  const [lane, setLane] = useState(1);
  const [books, setBooks] = useState<{ id: number; lane: number; y: number }[]>([]);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const laneRef = useRef(lane);
  const endRef = useRef(onEnd);
  useEffect(() => {
    laneRef.current = lane;
    endRef.current = onEnd;
  });

  useEffect(() => {
    if (!active || !running) return;
    let id = 0;
    let caught = 0;
    let missed = 0;
    let spawnIn = 0;
    const tick = setInterval(() => {
      spawnIn -= 1;
      setBooks((list) => {
        let next = list.map((b) => ({ ...b, y: b.y + 1.2 }));
        if (spawnIn <= 0) {
          next = [...next, { id: id++, lane: Math.floor(Math.random() * 3), y: 2 }];
          spawnIn = Math.max(9, 16 - caught);
        }
        const kept: typeof next = [];
        for (const b of next) {
          if (b.y >= FLOOR - 10) {
            if (b.lane === laneRef.current) {
              caught++;
              playPetSound("eat", pet.species);
            } else {
              missed++;
              playPetSound("shrug", pet.species);
            }
          } else kept.push(b);
        }
        setScore(caught);
        setMisses(missed);
        if (caught >= GOAL || missed >= 3) {
          setRunning(false);
          setTimeout(() => endRef.current(caught >= GOAL, caught), 0);
          return [];
        }
        return kept;
      });
    }, 70);
    return () => clearInterval(tick);
  }, [active, running, pet.species]);

  const press = (button: "left" | "right" | "a" | "b", exit: () => void) => {
    if (button === "b") {
      setRunning(false);
      setBooks([]);
      return exit();
    }
    if (!running) {
      if (button === "a") {
        setScore(0);
        setMisses(0);
        setBooks([]);
        setRunning(true);
        playPetSound("play", pet.species);
      }
      return;
    }
    if (button === "left") setLane((l) => Math.max(0, l - 1));
    if (button === "right") setLane((l) => Math.min(2, l + 1));
  };

  const scene = () => (
      <>
        {books.map((b) => (
          <g key={b.id}>
            <rect x={LANES[b.lane] + 2} y={b.y} width={4} height={5} fill="#0152cb" />
            <rect x={LANES[b.lane] + 3} y={b.y + 1} width={3} height={3} fill="#ffffff" />
          </g>
        ))}
        <g transform={`translate(${LANES[lane] - 4} ${FLOOR - 14})`}>
          <PetSprite look={pet} face={running ? "happy" : "open"} bare />
        </g>
      </>
  );

  return { running, score, misses, press, scene };
}
