import type { FocusMethod } from "./types";

/* The timer study sessions start with, remembered in this browser. Changing
   it in a session's setup or in Settings updates it. */

const KEY = "marginalia:timer";
const METHODS: FocusMethod[] = ["pomodoro", "52-17", "flow"];

export function readTimer(): FocusMethod {
  try {
    const saved = localStorage.getItem(KEY) as FocusMethod | null;
    return saved && METHODS.includes(saved) ? saved : "pomodoro";
  } catch {
    return "pomodoro";
  }
}

export function saveTimer(method: FocusMethod) {
  try {
    localStorage.setItem(KEY, method);
  } catch {
    // Private windows can block storage; the choice still applies to this session
  }
}
