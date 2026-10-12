/*
 * How the app tells the pet what's happening. Anything can send a signal; the
 * pet (if there is one on screen) reacts. Nothing breaks if no one's listening.
 */

export type PetSignal =
  | { kind: "reading" }
  | { kind: "found"; count: number }
  | { kind: "shrug" }
  | { kind: "eat"; label: string };

const SIGNAL = "marginalia:pet";
const BUILDER = "marginalia:pet-builder";

export function petSignal(signal: PetSignal) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SIGNAL, { detail: signal }));
}

export function onPetSignal(handler: (signal: PetSignal) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<PetSignal>).detail);
  window.addEventListener(SIGNAL, listener);
  return () => window.removeEventListener(SIGNAL, listener);
}

/** Opens the "Create your pet" builder from anywhere (the account menu, the egg). */
export function openPetBuilder() {
  window.dispatchEvent(new Event(BUILDER));
}

export function onOpenPetBuilder(handler: () => void) {
  window.addEventListener(BUILDER, handler);
  return () => window.removeEventListener(BUILDER, handler);
}

/** What kind of file an upload is, for the pet to name it. */
export function fileLabel(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "pdf" ? "PDF" : ext === "docx" ? "Word doc" : ext === "md" || ext === "markdown" ? "note" : "file";
}

/* Hiding the pet for a while: remembered on this device, undone from the account menu. */
const HIDDEN = "marginalia:pet-hidden";
const hiddenListeners = new Set<() => void>();
export function petHidden() {
  try {
    return localStorage.getItem(HIDDEN) === "1";
  } catch {
    return false;
  }
}
export function setPetHidden(hidden: boolean) {
  try {
    localStorage.setItem(HIDDEN, hidden ? "1" : "0");
  } catch {}
  hiddenListeners.forEach((l) => l());
}
export function subscribePetHidden(on: () => void) {
  hiddenListeners.add(on);
  return () => hiddenListeners.delete(on);
}
