"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { palette } from "@/lib/pet-art";
import { petGreeting, petLevel, petMood, type StudyStatus } from "@/lib/pet-care";
import { onPetSignal } from "@/lib/pet-events";
import { playPetSound } from "@/lib/pet-sounds";
import type { Pet } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PetSprite, type Face } from "./pet-sprite";

/*
 * The pet's handheld: a Game Boy-style body in the pet's colour (the bottom
 * right rounder than the rest) with flat colours and hard-edged bevels, and a
 * pixel-art screen: its room, the pet and the menu. Everything is laid out on
 * a 72 by 100 grid; one unit (--u) is up to 6.5px, smaller to fit a narrow or
 * short window, and one room pixel on the screen, so the spacing lines up.
 */

const GW = 72; // shell, in grid units
const GH = 100;
const RW = 48; // the screen's room
const RH = 36;
const FLOOR = 31; // where the pet's feet rest in the room
const SCREEN = { x: 12, y: 22 };
const LCD = "#e7effc";

const u = (n: number) => `calc(${n} * var(--u))`;
const place = (x: number, y: number, w: number, h: number) => ({ left: u(x), top: u(y), width: u(w), height: u(h) });

// Your buddy is a study partner: it studies with you, focuses with you, and
// keeps score. Edit lives on the Stats screen.
const MENU = [
  { id: "study", label: "Study" },
  { id: "focus", label: "Focus" },
  { id: "stats", label: "Stats" },
] as const;
type MenuId = (typeof MENU)[number]["id"];
type Screen = "home" | "stats";
type Reaction = "found" | "shrug" | "notes" | "pet";

export function PetDevice({
  pet,
  status,
  onEdit,
  onStudy,
  onFocus,
}: {
  pet: Pet;
  /** How your studying is going: its mood, greeting and stats. */
  status: StudyStatus;
  onEdit: () => void;
  onStudy: () => void;
  onFocus: () => void;
}) {
  const reduced = useReducedMotion();
  const [screen, setScreen] = useState<Screen>("home");
  const [selected, setSelected] = useState(0);
  const [x, setX] = useState(16);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [reaction, setReaction] = useState<{ kind: Reaction; seq: number } | null>(null);
  const [face, setFace] = useState<Face | null>(null);
  const [blink, setBlink] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const { level, progress } = petLevel(pet.xp);
  const mood = petMood(status);
  const colors = palette(pet.color);

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

  // Clock for the window; blinking; wandering about the room
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
      setBubble(petGreeting(pet.name, status));
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
      } else if (s.kind === "notes") {
        react("notes", "happy", 900);
        say(`New ${s.label} to study. +3 XP`);
      } else if (s.kind === "studied") {
        react("found", "happy", 1400);
        say(s.right ? `${s.right}/${s.count} right!` : `${s.count} cards done!`);
      } else if (s.kind === "focused") {
        react("found", "happy", 1400);
        say(`${s.minutes} min together!`);
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
    if (id === "study") {
      onStudy();
    } else if (id === "focus") {
      onFocus();
    } else if (id === "stats") {
      setScreen("stats");
    }
  };
  const press = (button: "left" | "right" | "a" | "b") => {
    setPressed(button);
    later(() => setPressed((p) => (p === button ? null : p)), 120);
    if (screen === "stats") {
      if (button === "a") onEdit();
      if (button === "b") setScreen("home");
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
    const map: Record<string, "left" | "right" | "a" | "b"> = { ArrowLeft: "left", ArrowRight: "right", Enter: "a", z: "a", " ": "a", x: "b", Backspace: "b" };
    const b = map[e.key];
    if (!b) return;
    e.preventDefault();
    press(b);
  };

  const hour = new Date(now).getHours();
  const text = "font-pixel leading-none";

  return (
    <div
      onKeyDown={onKey}
      className="relative mx-auto select-none"
      style={{ ["--u" as string]: "min(6.5px, calc((100vw - 2rem) / 72), calc((100dvh - 3rem) / 100))", width: u(GW), height: u(GH) }}
    >
      {/* The body: flat colour, a hard bevel, a soft shadow underneath */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: pet.color,
          borderRadius: `${u(4)} ${u(4)} ${u(14)} ${u(4)}`,
          border: `${u(0.6)} solid ${colors.O}`,
          boxShadow: `inset ${u(1.2)} ${u(1.2)} 0 ${colors.L}88, inset ${u(-1.4)} ${u(-1.4)} 0 ${colors.D}, 0 ${u(4)} ${u(6)} -${u(2)} rgb(1 40 110 / 0.35)`,
        }}
      />

      {/* Name */}
      <p className={cn(text, "absolute flex items-center justify-center font-semibold text-white")} style={{ ...place(8, 10, 56, 6), fontSize: u(3.4), textShadow: `0 ${u(0.5)} 0 ${colors.O}` }}>
        {pet.name}
      </p>

      {/* Bezel */}
      <div
        aria-hidden
        className="absolute bg-[#1d2433]"
        style={{ ...place(8, 18, 56, 52), borderRadius: `${u(2)} ${u(2)} ${u(8)} ${u(2)}`, boxShadow: `inset 0 ${u(0.8)} 0 #2b3446, inset 0 ${u(-0.8)} 0 #0f1520` }}
      />
      <span aria-hidden className="absolute rounded-full bg-[#ef4444] shadow-[0_0_6px_#ef4444]" style={place(10, 39, 1.2, 1.2)} />

      {/* Screen */}
      <div
        tabIndex={0}
        role="application"
        aria-label={`${pet.name}'s screen. ${mood}. Use the arrow keys to choose, Enter for A, X for B.`}
        className="absolute overflow-hidden outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ ...place(SCREEN.x, SCREEN.y, RW, RH), background: LCD, boxShadow: `0 0 0 ${u(0.4)} #0f1520` }}
        autoFocus
      >
        {screen === "stats" ? (
          <Stats pet={pet} status={status} level={level} progress={progress} mood={mood} />
        ) : (
          <svg viewBox={`0 0 ${RW} ${RH}`} shapeRendering="crispEdges" className="absolute inset-0 size-full" aria-hidden>
            <Room hour={hour} />
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
                      <PetSprite look={pet} face={face ?? (reading ? "side" : blink ? "closed" : "open")} book={reading} bare />
                    </g>
                  </motion.g>
                </motion.g>
          </svg>
        )}

        {/* Status strip */}
        {screen !== "stats" && (
          <div className={cn(text, "absolute inset-x-0 top-0 flex items-center justify-between bg-white/80 text-[#1d2433]")} style={{ height: u(4), padding: `0 ${u(1.5)}`, fontSize: u(2.2) }}>
            <span>Lv {level}</span>
            <span>{status.streak > 0 ? `${status.streak}-day streak` : mood}</span>
          </div>
        )}

        {bubble && screen !== "stats" && (
          <p
            className={cn(text, "absolute left-1/2 max-w-[90%] -translate-x-1/2 truncate rounded-[2px] bg-white text-[#1d2433] shadow-[0_1px_0_#1d243333]")}
            style={{ top: u(6), padding: `${u(1)} ${u(1.6)}`, fontSize: u(2.2) }}
          >
            {bubble}
          </p>
        )}
      </div>

      {/* Menu, on the bezel under the screen */}
      <div className="absolute grid grid-cols-3" style={{ ...place(SCREEN.x, 62, RW, 6), gap: u(0.8) }}>
        {MENU.map((m, i) => {
          const on = screen === "home" && i === selected;
          return (
            <button
              key={m.id}
              type="button"
              aria-label={m.label}
              disabled={screen !== "home"}
              onClick={() => {
                setSelected(i);
                if (screen === "home") run(m.id);
              }}
              className={cn(text, "flex flex-col items-center justify-center rounded-[3px] transition-colors duration-100 disabled:opacity-40", on ? "bg-[#e7effc] text-[#1d2433]" : "text-white/75 hover:bg-white/10")}
              style={{ fontSize: u(2), gap: u(0.6) }}
            >
              <PixelIcon name={m.id} color="currentColor" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <DPad pressed={pressed} onPress={(d) => press(d === "up" ? "left" : d === "down" ? "right" : d)} style={place(9, 75, 17, 17)} />
      <RoundButton label="B, back" letter="B" tone="b" pressed={pressed === "b"} onPress={() => press("b")} style={place(42, 80, 10, 10)} />
      <RoundButton label="A, choose" letter="A" tone="a" pressed={pressed === "a"} onPress={() => press("a")} style={place(55, 75, 10, 10)} />
      {/* Speaker slits */}
      {[0, 1, 2, 3].map((i) => (
        <span key={i} aria-hidden className="absolute rounded-full" style={{ ...place(54 + i * 2.6, 89, 1, 7), background: colors.D, transform: "rotate(-30deg)" }} />
      ))}
    </div>
  );
}

const MOVES = {
  found: { y: [0, -8, 0, -3, 0], transition: { duration: 0.7 } },
  shrug: { rotate: [0, -8, 8, -4, 0], transition: { duration: 0.6 } },
  notes: { scaleX: [1, 1.15, 0.92, 1.08, 1], scaleY: [1, 0.85, 1.08, 0.92, 1], transition: { duration: 0.6 } },
  pet: { scaleX: [1, 1.12, 0.95, 1], scaleY: [1, 0.82, 1.1, 1], transition: { duration: 0.45 } },
};

/* ---------- controls ---------- */

// Hard-edged bevels: a light top-left edge and a dark bottom-right edge, no blur
const bevel = (light: string, dark: string, pressed: boolean) =>
  pressed ? `inset ${u(0.6)} ${u(0.6)} 0 ${dark}` : `inset ${u(0.6)} ${u(0.6)} 0 ${light}, inset ${u(-0.8)} ${u(-0.8)} 0 ${dark}, 0 ${u(0.8)} 0 rgb(0 0 0 / 0.3)`;

const press = (onPress: () => void) => ({
  onPointerDown: (e: React.PointerEvent) => {
    e.preventDefault();
    onPress();
  },
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onPress();
    }
  },
});

function RoundButton({ label, letter, tone, pressed, onPress, style }: { label: string; letter: string; tone: "a" | "b"; pressed: boolean; onPress: () => void; style: React.CSSProperties }) {
  const c = tone === "a" ? { bg: "#df2224", light: "#ff8a8a", dark: "#8f1316", text: "#ffffff" } : { bg: "#facc15", light: "#fff3b0", dark: "#a8850a", text: "#3b2f06" };
  return (
    <button
      type="button"
      aria-label={label}
      {...press(onPress)}
      className="absolute grid place-items-center rounded-full font-pixel font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      style={{ ...style, background: c.bg, color: c.text, fontSize: u(3.6), boxShadow: bevel(c.light, c.dark, pressed), transform: pressed ? `translateY(${u(0.6)})` : undefined }}
    >
      {letter}
    </button>
  );
}

type Dir = "up" | "down" | "left" | "right";

/** A D-pad: a cross with an arrow on each arm; each arm can be pressed. */
function DPad({ pressed, onPress, style }: { pressed: string | null; onPress: (dir: Dir) => void; style: React.CSSProperties }) {
  // The menu treats up/down like left/right
  const down = (d: Dir) => pressed === d || (pressed === "left" && d === "up") || (pressed === "right" && d === "down");
  const arms: [Dir, React.CSSProperties, string][] = [
    ["up", { left: "35%", top: 0, width: "30%", height: "38%" }, "M3 0 6 4H0z"],
    ["down", { left: "35%", bottom: 0, width: "30%", height: "38%" }, "M3 4 6 0H0z"],
    ["left", { left: 0, top: "35%", width: "38%", height: "30%" }, "M0 3 4 0v6z"],
    ["right", { right: 0, top: "35%", width: "38%", height: "30%" }, "M4 3 0 0v6z"],
  ];
  return (
    <div className="absolute" style={style}>
      {/* The cross itself */}
      <div aria-hidden className="absolute bg-[#2b3446]" style={{ left: "35%", top: 0, width: "30%", height: "100%", borderRadius: u(0.8), boxShadow: bevel("#4b566b", "#141a26", false) }} />
      <div aria-hidden className="absolute bg-[#2b3446]" style={{ top: "35%", left: 0, height: "30%", width: "100%", borderRadius: u(0.8), boxShadow: bevel("#4b566b", "#141a26", false) }} />
      <div aria-hidden className="absolute rounded-full bg-[#222a38]" style={{ left: "40%", top: "40%", width: "20%", height: "20%" }} />
      {arms.map(([d, pos, path]) => (
        <button
          key={d}
          type="button"
          aria-label={d === "up" || d === "left" ? "Previous" : "Next"}
          {...press(() => onPress(d))}
          className="absolute grid place-items-center outline-none focus-visible:outline-2 focus-visible:outline-white"
          style={{ ...pos, background: down(d) ? "#00000040" : undefined, borderRadius: u(0.8) }}
        >
          <svg viewBox={d === "up" || d === "down" ? "0 0 6 4" : "0 0 4 6"} style={{ width: d === "up" || d === "down" ? u(2.4) : u(1.6), height: d === "up" || d === "down" ? u(1.6) : u(2.4) }} aria-hidden>
            <path d={path} fill="#8a94a8" />
          </svg>
        </button>
      ))}
    </div>
  );
}

const ICONS: Record<MenuId, string[]> = {
  study: ["XXX.XXX", "X.XXX.X", "X..X..X", "X..X..X", "X..X..X", "X.XXX.X", "XXX.XXX"],
  focus: ["..XXX..", ".X.X.X.", "X..X..X", "X..XX.X", "X.....X", ".X...X.", "..XXX.."],
  stats: [".....XX", ".....XX", "...XXXX", "...XXXX", ".XXXXXX", ".XXXXXX", "XXXXXXX"],
};

function PixelIcon({ name, color }: { name: MenuId; color: string }) {
  return (
    <svg viewBox="0 0 7 7" shapeRendering="crispEdges" style={{ width: u(2.8), height: u(2.8) }} aria-hidden>
      {ICONS[name].flatMap((row, y) => [...row].map((ch, x) => (ch === "X" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null)))}
    </svg>
  );
}

/* ---------- the room ---------- */

function Room({ hour }: { hour: number }) {
  const night = hour < 6 || hour >= 19;
  const dusk = !night && (hour >= 17 || hour < 7);
  const sky = night ? "#1b2a4a" : dusk ? "#f6a87a" : "#9fd3ff";
  const books = ["#df2224", "#0152cb", "#22c55e", "#f5a524", "#8b5cf6", "#0152cb", "#f472b6", "#22c55e"];
  return (
    <g>
      <rect width={RW} height={26} fill={LCD} />
      <rect y={24} width={RW} height={1} fill="#c9d6ef" />
      <rect y={25} width={RW} height={11} fill="#d9b98a" />
      {[0, 8, 16, 24, 32, 40].map((px) => (
        <rect key={px} x={px} y={25} width={1} height={11} fill="#c49e6b" />
      ))}
      <rect y={30} width={RW} height={1} fill="#c49e6b" />
      {/* Window, showing the time of day */}
      <rect x={30} y={6} width={13} height={11} fill="#ffffff" />
      <rect x={31} y={7} width={11} height={9} fill={sky} />
      {night ? (
        <>
          <rect x={38} y={8} width={2} height={2} fill="#fdf6c3" />
          <rect x={33} y={9} width={1} height={1} fill="#ffffff" />
          <rect x={35} y={13} width={1} height={1} fill="#ffffff" />
        </>
      ) : (
        <rect x={37} y={8} width={3} height={3} fill={dusk ? "#ffdf8a" : "#ffd23f"} />
      )}
      <rect x={36} y={7} width={1} height={9} fill="#ffffff" />
      <rect x={31} y={11} width={11} height={1} fill="#ffffff" />
      {/* Bookshelf */}
      <rect x={3} y={8} width={13} height={17} fill="#8a5a3b" />
      {[9, 14, 19].map((y, row) => (
        <g key={y}>
          <rect x={4} y={y} width={11} height={4} fill="#6d4429" />
          {books.slice(row * 2, row * 2 + 4).map((c, i) => (
            <rect key={i} x={5 + i * 2} y={y + (i % 2)} width={2} height={4 - (i % 2)} fill={c} />
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
    </g>
  );
}

/* ---------- stats ---------- */

function Stats({ pet, status, level, progress, mood }: { pet: Pet; status: StudyStatus; level: number; progress: number; mood: string }) {
  const rows: [string, string][] = [
    ["Streak", status.streak ? `${status.streak} ${status.streak === 1 ? "day" : "days"}` : "Start today"],
    ["Due now", `${status.due} ${status.due === 1 ? "card" : "cards"}`],
    ["This week", `${status.week.reviewed} cards`],
    ["Focus", `${status.week.focusMinutes} min`],
  ];
  const line = { fontSize: u(2.3) };
  return (
    <div className="absolute inset-0 font-pixel leading-none text-[#1d2433]" style={{ background: LCD, padding: u(3) }}>
      <div className="flex items-baseline justify-between" style={{ fontSize: u(2.8) }}>
        <span className="font-semibold">{pet.name}</span>
        <span style={line}>{mood}</span>
      </div>
      <div className="flex flex-col" style={{ marginTop: u(2.5), gap: u(1.6) }}>
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between" style={line}>
            <span className="opacity-70">{label}</span>
            <span>{value}</span>
          </div>
        ))}
        <div style={line}>
          <div className="flex justify-between">
            <span>Level {level}</span>
            <span>{pet.xp} XP</span>
          </div>
          <div className="flex" style={{ marginTop: u(1), gap: u(0.5) }}>
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} style={{ width: u(2.9), height: u(1.5), background: i < Math.round(progress * 12) ? "#0152cb" : "#1d243322" }} />
            ))}
          </div>
        </div>
      </div>
      <p className="absolute inset-x-0 text-center opacity-70" style={{ bottom: u(1.6), fontSize: u(1.8) }}>
        Earn XP by studying. A to edit, B to go back
      </p>
    </div>
  );
}
