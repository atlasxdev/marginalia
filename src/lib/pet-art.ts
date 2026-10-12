/*
 * The margin pet's pixel art. Every species is a 16×14 grid; the body is
 * painted in the colour you chose, with a lighter highlight, a deeper shade and
 * an outline worked out from it. Eyes, mouth and accessories are drawn on top,
 * at points each species defines.
 *
 *   O outline   B body   L highlight   D shade
 *   Y beak/feet (amber)  K book cover (Ink blue)  W page (white)
 */

export const SPECIES = ["blob", "cat", "bird", "bookworm"] as const;
export const EYES = ["dot", "sparkle", "sleepy"] as const;
export const ACCESSORIES = ["none", "glasses", "scarf", "bookmark"] as const;
export const COLORS = ["#4d9cff", "#0152cb", "#8b5cf6", "#f472b6", "#f97316", "#facc15", "#22c55e", "#94a3b8"] as const;

export type Species = (typeof SPECIES)[number];
export type Eyes = (typeof EYES)[number];
export type Accessory = (typeof ACCESSORIES)[number];
export type PetLook = { species: Species; color: string; eyes: Eyes; accessory: Accessory };

export const SPECIES_LABEL: Record<Species, string> = { blob: "Blob", cat: "Cat", bird: "Bird", bookworm: "Bookworm" };
export const EYES_LABEL: Record<Eyes, string> = { dot: "Dot", sparkle: "Sparkle", sleepy: "Sleepy" };
export const ACCESSORY_LABEL: Record<Accessory, string> = { none: "None", glasses: "Reading glasses", scarf: "Scarf", bookmark: "Bookmark" };

type Art = {
  rows: string[];
  /** Left pixel of each 2×2 eye, and the row they start on. */
  eyes: [number, number];
  eyeY: number;
  /** Left pixel and row of the 2-wide mouth. */
  mouth: [number, number];
  /** The row a scarf wraps around, and how far it spans. */
  neck: { y: number; from: number; to: number };
  /** Where a bookmark ribbon tucks into the head. */
  crown: [number, number];
};

export const ART: Record<Species, Art> = {
  blob: {
    rows: [
      "................",
      "......OOOO......",
      "....OOBBBBOO....",
      "...OBLLBBBBBO...",
      "..OBLBBBBBBBBO..",
      "..OBBBBBBBBBBO..",
      ".OBBBBBBBBBBBBO.",
      ".OBBBBBBBBBBBBO.",
      ".OBBBBBBBBBBBBO.",
      ".OBBBBBBBBBBBDO.",
      ".ODBBBBBBBBBBDO.",
      "..ODDBBBBBBDDO..",
      "...OODDDDDDOO...",
      ".....OOOOOO.....",
    ],
    eyes: [5, 9],
    eyeY: 7,
    mouth: [7, 10],
    neck: { y: 11, from: 3, to: 12 },
    crown: [9, 1],
  },
  cat: {
    rows: [
      "..OO........OO..",
      "..OBO......OBO..",
      "..OBBOOOOOOBBO..",
      ".OBBBBBBBBBBBBO.",
      ".OBLLBBBBBBBBBO.",
      ".OBLBBBBBBBBBBO.",
      ".OBBBBBBBBBBBBO.",
      ".OBBBBBBBBBBBBO.",
      ".OBBBBBBBBBBBDO.",
      "..OBBBBBBBBBDO..",
      "..OBBBBBBBBBDO..",
      "..ODBBBBBBBDDO..",
      "..OOOOOOOOOOOO..",
      "...OO......OO...",
    ],
    eyes: [4, 10],
    eyeY: 5,
    mouth: [7, 8],
    neck: { y: 10, from: 3, to: 12 },
    crown: [10, 2],
  },
  bird: {
    rows: [
      ".......OO.......",
      "......OBO.......",
      ".....OOOOOO.....",
      "....OBBBBBBO....",
      "...OBLLBBBBBO...",
      "..OBLBBBBBBBBO..",
      "..OBBBBBBBBBBO..",
      "..OBBBBBBBBBBOYY",
      "..OBBDDDBBBBBO..",
      "..OBDDDDBBBBDO..",
      "...OBDDBBBBDO...",
      "....OBBBBBBO....",
      ".....OOOOOO.....",
      ".....Y....Y.....",
    ],
    eyes: [6, 10],
    eyeY: 5,
    mouth: [8, 8],
    neck: { y: 10, from: 4, to: 11 },
    crown: [10, 3],
  },
  bookworm: {
    rows: [
      "................",
      "................",
      ".....OOOOO......",
      "....OBBBBBO.....",
      "...OBLBBBBBO....",
      "...OBBBBBBBO....",
      "...OBBBBBBBO....",
      "...ODBBBBBDO....",
      "....OBBBBBO.....",
      "....ODBBBDO.....",
      ".KKKKKOBBOKKKKK.",
      ".KWWWWWWWWWWWWK.",
      ".KWWWWWKKWWWWWK.",
      ".KKKKKKKKKKKKKK.",
    ],
    eyes: [5, 8],
    eyeY: 5,
    mouth: [6, 7],
    neck: { y: 8, from: 5, to: 9 },
    crown: [8, 2],
  },
};

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [hex(a), hex(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};

/** The colours a grid's letters stand for, from the body colour. */
export function palette(color: string): Record<string, string> {
  return {
    O: mix(color, "#0b1220", 0.62),
    B: color,
    L: mix(color, "#ffffff", 0.55),
    D: mix(color, "#0b1220", 0.2),
    Y: "#f5a524",
    K: "#0152cb",
    W: "#ffffff",
  };
}

export const INK = "#141a26";
export const DEFAULT_LOOK: PetLook = { species: "blob", color: "#4d9cff", eyes: "dot", accessory: "glasses" };
export const NAME_IDEAS = ["Mochi", "Footnote", "Inky", "Biscuit", "Margo", "Pip", "Folio", "Dewey"];
