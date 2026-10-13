/* Notes are saved twice: the editor's own JSON, so a note reopens exactly as
   written (fonts, colors, handwriting), and Markdown made from it, which is
   what gets indexed, searched and turned into flashcards. */

export const MAX_NOTE_JSON_CHARS = 3_500_000;

// The JSON sits next to the Markdown file in Storage
export const noteJsonPath = (storagePath: string) => `${storagePath.slice(0, storagePath.lastIndexOf("/"))}/note.json`;

/* ---------- handwriting ---------- */

// Strokes are stored on a canvas this many units wide, so they scale with the page
export const INK_WIDTH = 800;
export const INK_HEIGHTS = { min: 160, initial: 320, max: 1600 };

export type InkTool = "pen" | "marker";
export type Stroke = {
  tool: InkTool;
  color: string;
  size: number;
  // x, y, pressure, repeated
  points: number[];
};

// Theme tokens, so the ink follows light and dark mode
export const PEN_COLORS = [
  { name: "Ink", value: "var(--foreground)" },
  { name: "Blue", value: "var(--note-blue)" },
  { name: "Red", value: "var(--note-red)" },
  { name: "Green", value: "var(--note-green)" },
];

export const MARKER_COLORS = [
  { name: "Yellow", value: "var(--hl-yellow)" },
  { name: "Green", value: "var(--hl-green)" },
  { name: "Blue", value: "var(--hl-blue)" },
  { name: "Pink", value: "var(--hl-pink)" },
];

/** A short fingerprint of the strokes, to tell whether a transcription is current. */
export function inkSignature(strokes: Stroke[]) {
  if (!strokes.length) return "";
  const s = JSON.stringify(strokes);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${strokes.length}:${(h >>> 0).toString(36)}`;
}

/* ---------- text styles ---------- */

export const FONTS = [
  { name: "Sans", value: "" },
  { name: "Serif", value: "var(--font-serif)" },
  { name: "Mono", value: "var(--font-mono)" },
  { name: "Handwriting", value: "var(--font-hand)" },
];

export const SIZES = [
  { name: "Small", value: "14px" },
  { name: "Normal", value: "" },
  { name: "Large", value: "20px" },
  { name: "Huge", value: "28px" },
];

export const TEXT_COLORS = [
  { name: "Default", value: "" },
  { name: "Red", value: "var(--note-red)" },
  { name: "Orange", value: "var(--note-orange)" },
  { name: "Green", value: "var(--note-green)" },
  { name: "Blue", value: "var(--note-blue)" },
  { name: "Purple", value: "var(--note-purple)" },
];

export const HIGHLIGHTS = [
  { name: "Yellow", value: "var(--hl-yellow)" },
  { name: "Green", value: "var(--hl-green)" },
  { name: "Blue", value: "var(--hl-blue)" },
  { name: "Pink", value: "var(--hl-pink)" },
  { name: "Purple", value: "var(--hl-purple)" },
];
