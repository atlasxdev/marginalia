/*
 * How the app tells the pet what's happening. Anything can send a signal; the
 * pet (if there is one on screen) reacts. Nothing breaks if no one's listening.
 */

export type PetSignal =
  | { kind: "reading" }
  | { kind: "found"; count: number }
  | { kind: "shrug" }
  | { kind: "eat"; label: string }
  /** A study session ended: how many cards, and how many you got right. */
  | { kind: "studied"; count: number; right: number }
  /** A focus session ended. */
  | { kind: "focused"; minutes: number };

const SIGNAL = "marginalia:pet";
const OPEN = "marginalia:open-pet";

export function petSignal(signal: PetSignal) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SIGNAL, { detail: signal }));
}

export function onPetSignal(handler: (signal: PetSignal) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<PetSignal>).detail);
  window.addEventListener(SIGNAL, listener);
  return () => window.removeEventListener(SIGNAL, listener);
}

/** Opens your pet's handheld (or the builder, before you have one) from anywhere. */
export function openPet() {
  window.dispatchEvent(new Event(OPEN));
}

export function onOpenPet(handler: () => void) {
  window.addEventListener(OPEN, handler);
  return () => window.removeEventListener(OPEN, handler);
}

/** What kind of file an upload is, for the pet to name it. */
export function fileLabel(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "pdf" ? "PDF" : ext === "docx" ? "Word doc" : ext === "md" || ext === "markdown" ? "note" : "file";
}
