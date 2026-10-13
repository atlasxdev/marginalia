"use client";

import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { petSignal } from "./pet-events";
import type { FocusMethod } from "./types";

/* Focus sessions your buddy runs with you. The timer lives at the app's root so
   it keeps going as you move between pages, and in this browser's storage so a
   reload doesn't lose it. */

export const METHODS: Record<FocusMethod, { name: string; detail: string; focus: number | null; rest: number | null }> = {
  pomodoro: { name: "Pomodoro", detail: "25 minutes of focus, then a 5 minute break", focus: 25 * 60, rest: 5 * 60 },
  "52-17": { name: "52 / 17", detail: "52 minutes of focus, then a 17 minute break", focus: 52 * 60, rest: 17 * 60 },
  flow: { name: "Flow", detail: "Focus as long as it lasts. Your break is a fifth of it", focus: null, rest: null },
};

// Every fourth Pomodoro earns a longer break
const LONG_REST = 15 * 60;

export type FocusState =
  | { phase: "idle" }
  | { phase: "focus"; method: FocusMethod; startedAt: number; endsAt: number | null; pausedLeft: number | null; round: number }
  | { phase: "break"; method: FocusMethod; endsAt: number; round: number };

type FocusContext = {
  state: FocusState;
  method: FocusMethod;
  setMethod: (m: FocusMethod) => void;
  /** Seconds left in this phase, or seconds so far in a flow session. */
  seconds: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Ends focus early (saved if it was at least a minute), or ends a break. */
  stop: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const Context = createContext<FocusContext | null>(null);
const STORAGE = "marginalia:focus";
const METHOD_STORAGE = "marginalia:focus-method";

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked; the timer still works until a reload
  }
}

async function recordSession(method: FocusMethod, startedAt: number, focusSeconds: number) {
  await fetch("/api/study/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, focusSeconds, startedAt: new Date(startedAt).toISOString() }),
  }).catch(() => undefined);
}

export function FocusProvider({ children, onSaved }: { children: React.ReactNode; onSaved?: () => void }) {
  const [state, setState] = useState<FocusState>({ phase: "idle" });
  const [method, setMethodState] = useState<FocusMethod>("pomodoro");
  // Set on the client only; prerendering can't read the clock
  const [now, setNow] = useState(0);
  const [open, setOpen] = useState(false);

  // Pick up a session from before a reload. Storage isn't there on the server,
  // so this runs after the first render rather than in the initial state.
  useEffect(() => {
    const saved = load<FocusState>(STORAGE);
    const m = load<FocusMethod>(METHOD_STORAGE);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from browser storage once
    if (saved) setState(saved);
    setNow(Date.now());
    if (m && m in METHODS) setMethodState(m);
  }, []);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
    save(STORAGE, state);
  }, [state]);

  const setMethod = (m: FocusMethod) => {
    setMethodState(m);
    save(METHOD_STORAGE, m);
  };


  const finishFocus = useCallback(
    (s: Extract<FocusState, { phase: "focus" }>, at: number) => {
      const focusSeconds = Math.round(((s.endsAt ?? at) - s.startedAt) / 1000);
      const minutes = Math.round(focusSeconds / 60);
      if (focusSeconds >= 60) {
        void recordSession(s.method, s.startedAt, focusSeconds).then(onSaved);
        petSignal({ kind: "focused", minutes });
      }
      const config = METHODS[s.method];
      const rest = config.rest ? (s.method === "pomodoro" && s.round % 4 === 0 ? LONG_REST : config.rest) : Math.max(60, Math.round(focusSeconds / 5));
      setState({ phase: "break", method: s.method, endsAt: at + rest * 1000, round: s.round });
      toast.success(`${minutes} ${minutes === 1 ? "minute" : "minutes"} of focus done. Take a ${Math.round(rest / 60)} minute break.`);
    },
    [onSaved]
  );

  // Tick once a second while something's running; a timed phase ends on its own
  useEffect(() => {
    if (state.phase === "idle") return;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      const s = latest.current;
      if (s.phase === "focus" && s.endsAt && s.pausedLeft === null && at >= s.endsAt) finishFocus(s, s.endsAt);
      if (s.phase === "break" && at >= s.endsAt) {
        setState({ phase: "idle" });
        toast("Break's over. Ready for another round?", { action: { label: "Start", onClick: () => setOpen(true) } });
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.phase, finishFocus]);

  const start = () => {
    const at = Date.now();
    const config = METHODS[method];
    const round = state.phase === "break" ? state.round + 1 : 1;
    setNow(at);
    setState({ phase: "focus", method, startedAt: at, endsAt: config.focus ? at + config.focus * 1000 : null, pausedLeft: null, round });
  };

  const pause = () => {
    if (state.phase !== "focus" || !state.endsAt || state.pausedLeft !== null) return;
    setState({ ...state, pausedLeft: state.endsAt - Date.now() });
  };

  const resume = () => {
    if (state.phase !== "focus" || state.pausedLeft === null || !state.endsAt) return;
    const at = Date.now();
    // The pause doesn't count as focus, so the start moves forward by it too
    const paused = at - (state.endsAt - state.pausedLeft);
    setState({ ...state, startedAt: state.startedAt + paused, endsAt: at + state.pausedLeft, pausedLeft: null });
  };

  const stop = () => {
    if (state.phase === "focus") {
      const at = state.pausedLeft !== null && state.endsAt ? state.endsAt - state.pausedLeft : Date.now();
      if (at - state.startedAt >= 60_000) finishFocus({ ...state, endsAt: at }, at);
      else setState({ phase: "idle" });
    } else {
      setState({ phase: "idle" });
    }
  };

  const seconds =
    state.phase === "idle"
      ? (METHODS[method].focus ?? 0)
      : state.phase === "focus"
        ? state.pausedLeft !== null
          ? Math.ceil(state.pausedLeft / 1000)
          : state.endsAt
            ? Math.max(0, Math.ceil((state.endsAt - now) / 1000))
            : Math.floor((now - state.startedAt) / 1000)
        : Math.max(0, Math.ceil((state.endsAt - now) / 1000));

  return (
    <Context value={{ state, method, setMethod, seconds, start, pause, resume, stop, open, setOpen }}>{children}</Context>
  );
}

export function useFocus() {
  const context = use(Context);
  if (!context) throw new Error("useFocus needs a FocusProvider");
  return context;
}

export function clock(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
