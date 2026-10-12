"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from "motion/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CookieIcon, EyeOffIcon, HandHeartIcon, MoonIcon, PaletteIcon, SunIcon, ToyBrickIcon } from "lucide-react";
import { toast } from "sonner";
import { movePet } from "@/app/actions/pet";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { onOpenPetBuilder, onPetSignal, petHidden, setPetHidden, subscribePetHidden } from "@/lib/pet-events";
import { playPetSound } from "@/lib/pet-sounds";
import { petQuery } from "@/lib/queries";
import type { Pet } from "@/lib/types";
import { PetBuilder } from "./pet-builder";
import { PetSprite, type Face } from "./pet-sprite";

/*
 * The margin pet, on desktop. Drag it anywhere (it remembers where), click it
 * for things to do together: pet, feed, play, nap, change its look, or hide it.
 * It also follows along with the app: reads while an answer streams, cheers
 * when the answer cites your files, shrugs when they don't have it, nibbles
 * uploads, and dozes off when you've been away. Before you've made one, an egg
 * waits in the corner.
 */

const W = 64; // sprite size in CSS px (4 per art pixel)
const H = 68;
const SLEEP_AFTER = 60_000;

const useDesktop = () =>
  useSyncExternalStore(
    (on) => {
      const q = window.matchMedia("(min-width: 1024px)");
      q.addEventListener("change", on);
      return () => q.removeEventListener("change", on);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false
  );

export function MarginPet() {
  const desktop = useDesktop();
  const hidden = useSyncExternalStore(subscribePetHidden, petHidden, () => false);
  const pet = useQuery(petQuery);
  const [building, setBuilding] = useState(false);
  useEffect(
    () =>
      onOpenPetBuilder(() => {
        setPetHidden(false);
        setBuilding(true);
      }),
    []
  );

  return (
    <>
      {desktop && !hidden && pet.isSuccess && (pet.data ? <Creature key={pet.data.name} pet={pet.data} onEdit={() => setBuilding(true)} /> : <Egg onHatch={() => setBuilding(true)} />)}
      <PetBuilder open={building} onOpenChange={setBuilding} pet={pet.data ?? null} />
    </>
  );
}

type Reaction = "found" | "shrug" | "eat" | "pet" | "land" | "wake" | "play";

const MOVES: Record<Reaction, TargetAndTransition> = {
  found: { y: [0, -22, 0, -8, 0], scaleY: [1, 1.15, 0.85, 1.05, 1], transition: { duration: 0.7 } },
  shrug: { rotate: [0, -8, 8, -4, 0], transition: { duration: 0.6 } },
  eat: { scaleX: [1, 1.18, 0.92, 1.1, 1], scaleY: [1, 0.85, 1.08, 0.9, 1], transition: { duration: 0.6 } },
  pet: { scaleX: [1, 1.15, 0.95, 1], scaleY: [1, 0.78, 1.12, 1], transition: { duration: 0.45 } },
  land: { scaleX: [1.2, 0.95, 1], scaleY: [0.75, 1.1, 1], transition: { duration: 0.35 } },
  wake: { scaleY: [1, 1.18, 1], transition: { duration: 0.5 } },
  play: { y: [0, -36, 0, -12, 0], rotate: [0, 180, 360, 360, 360], scaleY: [1, 1.1, 0.8, 1.05, 1], transition: { duration: 0.9 } },
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function Creature({ pet, onEdit }: { pet: Pet; onEdit: () => void }) {
  const reduced = useReducedMotion();
  const queryClient = useQueryClient();
  const [pos, setPos] = useState({ x: pet.x, y: pet.y ?? 1 });
  const [reaction, setReaction] = useState<{ kind: Reaction; seq: number } | null>(null);
  const [reading, setReading] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const [napping, setNapping] = useState(false);
  const [blink, setBlink] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; seq: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [menu, setMenu] = useState(false);
  const [snack, setSnack] = useState(0);
  const lastActive = useRef(0);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const faceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [face, setFace] = useState<Face | null>(null);

  const say = (text: string, ms = 2600) => {
    setBubble((b) => ({ text, seq: (b?.seq ?? 0) + 1 }));
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  };
  const react = (kind: Reaction, holdFace?: Face, ms = 900) => {
    setReaction((r) => ({ kind, seq: (r?.seq ?? 0) + 1 }));
    playPetSound(kind, pet.species);
    if (holdFace) {
      setFace(holdFace);
      clearTimeout(faceTimer.current);
      faceTimer.current = setTimeout(() => setFace(null), ms);
    }
  };
  const wake = () => {
    lastActive.current = Date.now();
    setAsleep((was) => {
      if (was) react("wake");
      return false;
    });
  };

  // Hello, and blinking
  useEffect(() => {
    lastActive.current = Date.now();
    const hi = setTimeout(() => {
      say(`Hi, I'm ${pet.name}!`);
      playPetSound("hi", pet.species);
    }, 600);
    let blinkOff: ReturnType<typeof setTimeout>;
    const blinker = setInterval(() => {
      setBlink(true);
      blinkOff = setTimeout(() => setBlink(false), 140);
    }, 4200);
    return () => {
      clearTimeout(hi);
      clearInterval(blinker);
      clearTimeout(blinkOff);
    };
    // Greets once per pet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.name]);

  // Dozes off when you've been away; wakes when you're back (a nap you started lasts until you wake it)
  useEffect(() => {
    const active = () => wake();
    window.addEventListener("pointermove", active, { passive: true });
    window.addEventListener("keydown", active);
    const check = setInterval(() => {
      if (Date.now() - lastActive.current > SLEEP_AFTER) setAsleep(true);
    }, 5000);
    return () => {
      window.removeEventListener("pointermove", active);
      window.removeEventListener("keydown", active);
      clearInterval(check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What the app tells it
  useEffect(
    () =>
      onPetSignal((s) => {
        wake();
        setNapping(false);
        if (s.kind === "reading") {
          setReading(true);
          say("Reading along…", 60_000);
        } else if (s.kind === "found") {
          setReading(false);
          react("found", "happy", 1400);
          say(s.count > 1 ? `Found it, in ${s.count} places!` : "Found it!");
        } else if (s.kind === "shrug") {
          setReading(false);
          react("shrug", "flat", 1400);
          say("Not in your files.");
        } else if (s.kind === "eat") {
          react("eat", "chomp", 700);
          say(`Mm, a ${s.label}.`);
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Dragging anywhere on screen; a press without moving opens the menu
  const drag = useRef<{ startX: number; startY: number; dx: number; dy: number; moved: boolean } | null>(null);
  const place = (clientX: number, clientY: number, d: { dx: number; dy: number }) => ({
    x: clamp01((clientX - d.dx) / (window.innerWidth - W)),
    y: clamp01((clientY - d.dy) / (window.innerHeight - H - 6)),
  });
  const save = (next: { x: number; y: number }) => {
    queryClient.setQueryData<Pet | null>(["pet"], (p) => (p ? { ...p, ...next } : p));
    void movePet(next.x, next.y);
  };

  // Things to do together
  const actions = {
    pet: () => {
      wake();
      setNapping(false);
      react("pet", "happy", 900);
      say(["♥", "Hehe!", "More, please.", "♥ ♥"][Math.floor(Math.random() * 4)]);
    },
    feed: () => {
      wake();
      setNapping(false);
      setSnack((n) => n + 1);
      setTimeout(() => {
        react("eat", "chomp", 700);
        say("Yum, a cookie!");
      }, 380);
    },
    play: () => {
      wake();
      setNapping(false);
      react("play", "happy", 1000);
      say("Wheee!");
    },
    nap: () => {
      if (napping) {
        setNapping(false);
        react("wake");
        say("Morning!");
      } else {
        setNapping(true);
        playPetSound("nap", pet.species);
        say("Nap time… zzz");
      }
    },
    hide: () => {
      setPetHidden(true);
      toast(`${pet.name} is hiding`, { description: "Bring them back from your account menu, under Your pet." });
    },
  };

  const sleeping = asleep || napping;
  const shownFace: Face = sleeping ? "closed" : face ?? (reading ? "side" : blink ? "closed" : "open");
  const nearTop = pos.y < 0.18;

  return (
    <div
      className="pointer-events-none fixed z-40"
      style={{ left: `calc(${pos.x} * (100vw - ${W}px))`, top: `calc(${pos.y} * (100dvh - ${H + 6}px))`, width: W }}
    >
      {/* Speech */}
      <AnimatePresence>
        {bubble && !dragging && !menu && (
          <motion.p
            key={bubble.seq}
            initial={reduced ? false : { opacity: 0, y: nearTop ? -6 : 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`glass absolute left-1/2 -translate-x-1/2 rounded-full border border-glass-border bg-glass-strong px-3 py-1 text-xs font-medium whitespace-nowrap shadow-sm ${nearTop ? "top-full mt-2" : "bottom-full mb-1"}`}
            role="status"
          >
            {bubble.text}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Sleeping */}
      {sleeping && !reduced && (
        <div className="absolute -top-2 right-0 font-mono text-xs font-bold text-primary/70" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute"
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0], x: [0, 6 + i * 2], y: [0, -18 - i * 4] }}
              transition={{ duration: 2.4, delay: i * 0.8, repeat: Infinity }}
            >
              z
            </motion.span>
          ))}
        </div>
      )}

      {/* A cookie dropping in */}
      <AnimatePresence>
        {snack > 0 && (
          <motion.span
            key={snack}
            className="absolute left-1/2 text-lg"
            initial={{ y: -60, x: -8, opacity: 0, rotate: -30 }}
            animate={{ y: 18, opacity: [0, 1, 1, 0], rotate: 20 }}
            transition={{ duration: 0.45, ease: "easeIn" }}
            aria-hidden
          >
            🍪
          </motion.span>
        )}
      </AnimatePresence>

      <Effects reaction={reaction} reduced={!!reduced} />

      <Popover open={menu} onOpenChange={setMenu}>
        <PopoverAnchor asChild>
          <motion.button
            type="button"
            aria-label={`${pet.name}, your pet. Click for things to do, drag or use the arrow keys to move it.`}
            aria-haspopup="menu"
            aria-expanded={menu}
            title={pet.name}
            className="pointer-events-auto relative block cursor-grab touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing"
            style={{ originY: 1 }}
            animate={reaction && !reduced ? MOVES[reaction.kind] : undefined}
            key={reaction?.seq ?? 0}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const r = e.currentTarget.getBoundingClientRect();
              drag.current = { startX: e.clientX, startY: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
              if (!d.moved) setMenu(false);
              d.moved = true;
              setDragging(true);
              setPos(place(e.clientX, e.clientY, d));
            }}
            onPointerUp={(e) => {
              const d = drag.current;
              drag.current = null;
              setDragging(false);
              if (d?.moved) {
                const next = place(e.clientX, e.clientY, d);
                setPos(next);
                save(next);
                react("land");
              } else {
                wake();
                setMenu((m) => !m);
              }
            }}
            onKeyDown={(e) => {
              const step = 0.04;
              const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
              const m = moves[e.key];
              if (m) {
                e.preventDefault();
                const next = { x: clamp01(pos.x + m[0]), y: clamp01(pos.y + m[1]) };
                setPos(next);
                save(next);
              } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setMenu((o) => !o);
              }
            }}
          >
            <motion.div
              style={{ originY: 1 }}
              animate={reduced || dragging ? { scaleY: 1 } : { scaleY: [1, 1.035, 1] }}
              transition={{ duration: sleeping ? 3.6 : 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div animate={{ rotate: dragging ? -8 : 0, y: dragging ? -4 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 18 }} style={{ originY: 1 }}>
                <PetSprite look={pet} face={shownFace} book={reading} className="h-[68px] w-16" />
              </motion.div>
            </motion.div>
          </motion.button>
        </PopoverAnchor>
        <PopoverContent
          side={nearTop ? "bottom" : "top"}
          align="center"
          sideOffset={8}
          className="glass w-auto border border-glass-border bg-glass-strong p-1.5"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div role="menu" aria-label={`Things to do with ${pet.name}`} className="flex gap-0.5">
            <PetAction icon={<HandHeartIcon />} label="Pet" onClick={actions.pet} />
            <PetAction icon={<CookieIcon />} label="Feed" onClick={actions.feed} />
            <PetAction icon={<ToyBrickIcon />} label="Play" onClick={actions.play} />
            <PetAction icon={napping ? <SunIcon /> : <MoonIcon />} label={napping ? "Wake" : "Nap"} onClick={actions.nap} />
            <PetAction
              icon={<PaletteIcon />}
              label="Edit"
              onClick={() => {
                setMenu(false);
                onEdit();
              }}
            />
            <PetAction icon={<EyeOffIcon />} label="Hide" onClick={actions.hide} />
          </div>
        </PopoverContent>
      </Popover>
      <div className="mx-auto -mt-1 h-1.5 w-12 rounded-[100%] bg-foreground/10" aria-hidden />
    </div>
  );
}

function PetAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-14 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-glass hover:text-foreground active:scale-95 [&_svg]:size-[18px] [&_svg]:text-primary"
    >
      {icon}
      {label}
    </button>
  );
}

/** Hearts when petted or played with, sparkles when it finds the answer. */
function Effects({ reaction, reduced }: { reaction: { kind: Reaction; seq: number } | null; reduced: boolean }) {
  if (!reaction || reduced || !["pet", "found", "play"].includes(reaction.kind)) return null;
  const heart = reaction.kind !== "found";
  return (
    <div key={reaction.seq} className="pointer-events-none absolute inset-x-0 bottom-12 h-0" aria-hidden>
      {[-1, 0, 1].map((i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 text-sm"
          initial={{ opacity: 0, x: i * 6, y: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 0], x: i * 18, y: -36 - Math.abs(i) * 6, scale: 1 }}
          transition={{ duration: 0.9, delay: Math.abs(i) * 0.08, ease: "easeOut" }}
          style={{ color: heart ? "#f472b6" : "#f5a524" }}
        >
          {heart ? "♥" : "✦"}
        </motion.span>
      ))}
    </div>
  );
}

/** Before you've made a pet: an egg that wobbles now and then. */
function Egg({ onHatch }: { onHatch: () => void }) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);
  return (
    <div className="pointer-events-none fixed right-4 bottom-1 z-40 flex flex-col items-center">
      <AnimatePresence>
        {hover && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="glass mb-1 rounded-full border border-glass-border bg-glass-strong px-3 py-1 text-xs font-medium whitespace-nowrap"
          >
            Hatch a pet
          </motion.p>
        )}
      </AnimatePresence>
      <motion.button
        type="button"
        aria-label="Create a pet"
        onClick={onHatch}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className="pointer-events-auto rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        style={{ originY: 1 }}
        animate={reduced ? undefined : { rotate: [0, 0, -8, 8, -5, 0, 0] }}
        transition={{ duration: 6, repeat: Infinity, times: [0, 0.8, 0.84, 0.88, 0.92, 0.96, 1] }}
        whileHover={reduced ? undefined : { scale: 1.08 }}
        whileTap={reduced ? undefined : { scale: 0.92 }}
      >
        <svg viewBox="0 0 10 12" shapeRendering="crispEdges" className="h-12 w-10" aria-hidden>
          {[
            "...OOOO...",
            "..OCCCCO..",
            ".OCCCCCCO.",
            ".OCCSCCCO.",
            "OCCCCCCSCO",
            "OCSCCCCCCO",
            "OCCCCSCCCO",
            "OCCCCCCCCO",
            "OCSCCCCSCO",
            ".OCCCCCCO.",
            "..OCCCCO..",
            "...OOOO...",
          ].flatMap((row, y) =>
            [...row].map((ch, x) =>
              ch === "." ? null : (
                <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={ch === "O" ? "#64748b" : ch === "S" ? "#4d9cff" : "#fdf8ec"} />
              )
            )
          )}
        </svg>
      </motion.button>
      <div className="-mt-0.5 h-1 w-8 rounded-[100%] bg-foreground/10" aria-hidden />
    </div>
  );
}
