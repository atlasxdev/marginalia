"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { PetLook } from "@/lib/pet-art";
import { cn } from "@/lib/utils";
import { PetSprite, type Face } from "./pet/pet-sprite";

/* Your buddy talking you through something: the welcome screens and the tour. */

/** Text typed out a couple of letters at a time; key it by the text so it starts over when that changes. */
export function Typed({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let n = 0;
    const t = setInterval(() => {
      n += 2;
      setShown(n);
      if (n >= text.length) clearInterval(t);
    }, 24);
    return () => clearInterval(t);
  }, [text, reduced]);
  const typed = reduced ? text.length : shown;

  return (
    <>
      <span role="status" className="sr-only">
        {text}
      </span>
      {/* The untyped rest holds the text at its full size while the letters come in */}
      <span aria-hidden>
        {text.slice(0, typed)}
        <span className="invisible">{text.slice(typed)}</span>
      </span>
    </>
  );
}

/** What your buddy says, in a speech bubble. `side` points the tail left, at a buddy beside it; otherwise down, at one below. */
export function Bubble({ text, side }: { text: string; side?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.p
      initial={reduced ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 26 }}
      style={{ originX: side ? 0 : 0.5, originY: 1 }}
      className={cn(
        "relative rounded-2xl bg-popover px-4 py-3 text-[15px] leading-snug font-medium text-balance shadow-sm ring-1 ring-foreground/10",
        "after:absolute after:size-3 after:rotate-45 after:bg-popover",
        side
          ? "mb-8 flex-1 after:bottom-5 after:-left-1.5 after:shadow-[-1px_1px_0_0_color-mix(in_srgb,var(--foreground)_10%,transparent)]"
          : "max-w-xs after:-bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:shadow-[1px_1px_0_0_color-mix(in_srgb,var(--foreground)_10%,transparent)]"
      )}
    >
      <Typed key={text} text={text} />
    </motion.p>
  );
}

/** Your buddy: bobs while idle, blinks now and then, and squashes and stretches each time `hop` changes. */
export function Buddy({ look, face, hop, book, className }: { look: PetLook; face: Face; hop: number; book?: boolean; className?: string }) {
  const reduced = useReducedMotion();
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (reduced) return;
    let off: ReturnType<typeof setTimeout>;
    const t = setInterval(() => {
      setBlink(true);
      off = setTimeout(() => setBlink(false), 140);
    }, 3200);
    return () => (clearInterval(t), clearTimeout(off));
  }, [reduced]);

  return (
    <motion.div
      key={hop}
      initial={reduced ? false : { scaleY: 0.8, scaleX: 1.14 }}
      animate={{ scaleY: 1, scaleX: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 13 }}
      style={{ originY: 1 }}
    >
      <div className="origin-bottom animate-[pet-hop-idle_3.2s_ease-in-out_infinite] motion-reduce:animate-none">
        <PetSprite look={look} face={blink && face === "open" ? "closed" : face} book={book} className={className} />
      </div>
    </motion.div>
  );
}

/** A pop of pixel confetti, fired each time `fire` goes up. */
export function Burst({ fire, color }: { fire: number; color: string }) {
  const reduced = useReducedMotion();
  if (!fire || reduced) return null;
  const colors = [color, "#facc15", "#f472b6", "#22c55e", "#4d9cff"];
  return (
    <div key={fire} aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 z-10">
      {Array.from({ length: 26 }, (_, i) => {
        // Spread evenly round the circle, at a few set distances, so it looks random without being random
        const angle = i * 2.4;
        const dist = 80 + ((i * 37) % 70);
        return (
          <motion.span
            key={i}
            className="absolute block"
            style={{ width: i % 3 ? 8 : 6, height: i % 3 ? 8 : 6, background: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: Math.cos(angle) * dist, y: [0, Math.sin(angle) * dist - 30, Math.sin(angle) * dist + 50], opacity: [1, 1, 0], rotate: 180 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}
