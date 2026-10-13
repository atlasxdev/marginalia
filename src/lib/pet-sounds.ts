/*
 * The pet's voice: tiny chiptune chirps made with the Web Audio API, so
 * there are no sound files. Each species has its own pitch (a bird chirps
 * high, a blob boops low). Quiet by design.
 */
import type { Species } from "./pet-art";

export type PetSound = "hi" | "pet" | "found" | "shrug" | "notes" | "hatch" | "flip" | "done";

const SOUND_KEY = "marginalia:sounds";

/** Whether sound effects are on (they are unless turned off). */
export function soundsOn() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundsOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Storage can be blocked; the choice lasts for this page
  }
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
  if (!soundsOn()) return;
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
    case "notes": // "ooh!", new notes to study
      note(a, t, 440 * p, 0.08, { type: "triangle", gain: 0.06 });
      note(a, t + 0.09, 660 * p, 0.16, { to: 720 * p, type: "triangle", gain: 0.06 });
      break;
    case "flip": // a soft paper tick, for turning a card
      note(a, t, 900 * p, 0.035, { to: 600 * p, type: "triangle", gain: 0.035 });
      break;
    case "done": // a little victory jingle, for finishing a session
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => note(a, t + i * 0.09, f * p, i >= 4 ? 0.2 : 0.08, { type: i % 2 ? "triangle" : "square", gain: 0.05 }));
      break;
    case "hatch": // crack, then a fanfare
      note(a, t, 1400, 0.03, { type: "sawtooth", gain: 0.04 });
      note(a, t + 0.06, 1200, 0.03, { type: "sawtooth", gain: 0.04 });
      [392, 523, 659, 784].forEach((f, i) => note(a, t + 0.16 + i * 0.08, f * p, i === 3 ? 0.25 : 0.09));
      break;
  }
}
