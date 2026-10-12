/*
 * The pet's voice: tiny chiptune chirps made with the Web Audio API, so
 * there are no sound files. Each species has its own pitch (a bird chirps
 * high, a blob boops low). Quiet by design, and off with one toggle that's
 * remembered on this device.
 */
import type { Species } from "./pet-art";

export type PetSound = "hi" | "pet" | "found" | "shrug" | "eat" | "land" | "wake" | "hatch" | "play" | "nap";

const KEY = "marginalia:pet-sounds";
const listeners = new Set<() => void>();

export function soundsOn() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function setSoundsOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  listeners.forEach((l) => l());
}
export function subscribeSounds(on: () => void) {
  listeners.add(on);
  return () => listeners.delete(on);
}

const PITCH: Record<Species, number> = { bird: 1.5, cat: 1.15, bookworm: 0.95, blob: 0.8 };

let ctx: AudioContext | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  // Stay quiet until the page has been clicked or tapped (browsers block sound before that)
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
  ctx ??= new AudioContext();
  // Browsers start audio suspended until the page has been clicked
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** One note: square-ish wave, quick attack, short decay, optional pitch slide. */
function note(a: AudioContext, at: number, freq: number, length: number, { to, type = "square", gain = 0.05 }: { to?: number; type?: OscillatorType; gain?: number } = {}) {
  const osc = a.createOscillator();
  const amp = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + length);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(amp).connect(a.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

export function playPetSound(sound: PetSound, species: Species) {
  if (!soundsOn() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = audio();
  if (!a) return;
  const p = PITCH[species];
  const t = a.currentTime + 0.01;
  switch (sound) {
    case "hi": // "hi-i!"
      note(a, t, 520 * p, 0.09);
      note(a, t + 0.1, 780 * p, 0.14, { to: 860 * p });
      break;
    case "pet": // a happy little trill
      [660, 740, 880].forEach((f, i) => note(a, t + i * 0.06, f * p, 0.08, { type: "triangle", gain: 0.06 }));
      break;
    case "found": // ta-da arpeggio
      [523, 659, 784, 1047].forEach((f, i) => note(a, t + i * 0.07, f * p, i === 3 ? 0.22 : 0.08));
      break;
    case "shrug": // a falling "hmm"
      note(a, t, 440 * p, 0.32, { to: 300 * p, type: "triangle", gain: 0.06 });
      break;
    case "eat": // nom nom
      note(a, t, 220 * p, 0.06, { to: 160 * p, gain: 0.07 });
      note(a, t + 0.11, 240 * p, 0.06, { to: 170 * p, gain: 0.07 });
      break;
    case "land": // soft thump
      note(a, t, 160 * p, 0.09, { to: 90 * p, type: "sine", gain: 0.12 });
      break;
    case "wake": // yawn
      note(a, t, 300 * p, 0.45, { to: 520 * p, type: "triangle", gain: 0.05 });
      break;
    case "play": // boing!
      note(a, t, 260 * p, 0.18, { to: 780 * p, type: "triangle", gain: 0.06 });
      note(a, t + 0.2, 780 * p, 0.12, { to: 520 * p, type: "triangle", gain: 0.05 });
      break;
    case "nap": // a sleepy sigh
      note(a, t, 420 * p, 0.6, { to: 220 * p, type: "sine", gain: 0.06 });
      break;
    case "hatch": // crack, then a fanfare
      note(a, t, 1400, 0.03, { type: "sawtooth", gain: 0.04 });
      note(a, t + 0.06, 1200, 0.03, { type: "sawtooth", gain: 0.04 });
      [392, 523, 659, 784].forEach((f, i) => note(a, t + 0.16 + i * 0.08, f * p, i === 3 ? 0.25 : 0.09));
      break;
  }
}
