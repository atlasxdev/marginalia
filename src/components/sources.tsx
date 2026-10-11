"use client";

import { createContext, use, useEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { CitedSource } from "@/lib/format-response";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/*
 * One conversation's sources view. On a wide screen it's a panel docked beside
 * the chat, so an answer and its passages read side by side; below lg it's a
 * drawer from the bottom. `key` names the answer whose sources are shown, so
 * only that answer's citations light up with the passages.
 */
type Shown = { key: string; sources: CitedSource[] };
type Active = { key: string; n: number };
type SourcesState = {
  shown: Shown | null;
  /** The last sources shown, kept while the drawer animates closed. */
  last: Shown | null;
  /** The passage asked for: scrolled to, and highlighted while nothing is hovered. `seq` bumps so asking twice still scrolls. */
  focus: { key: string; n: number; seq: number } | null;
  active: Active | null;
  /** Show an answer's sources, scrolled to passage `n` if given. */
  show: (key: string, sources: CitedSource[], n?: number) => void;
  close: () => void;
  setActive: (key: string, n: number | null) => void;
};

const SourcesContext = createContext<SourcesState | null>(null);

export function useSources() {
  const ctx = use(SourcesContext);
  if (!ctx) throw new Error("useSources needs a SourcesProvider");
  return ctx;
}

export function SourcesProvider({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [last, setLast] = useState<Shown | null>(null);
  const [active, setActiveState] = useState<Active | null>(null);
  const [focus, setFocus] = useState<SourcesState["focus"]>(null);

  const state: SourcesState = {
    shown,
    last,
    active,
    focus,
    show(key, sources, n) {
      setShown({ key, sources });
      setLast({ key, sources });
      if (n === undefined) {
        setFocus(null);
      } else {
        setActiveState({ key, n });
        setFocus((f) => ({ key, n, seq: (f?.seq ?? 0) + 1 }));
      }
    },
    close() {
      setShown(null);
      setActiveState(null);
      setFocus(null);
    },
    setActive(key, n) {
      setActiveState(n === null ? null : { key, n });
    },
  };

  return <SourcesContext value={state}>{children}</SourcesContext>;
}

const documentsOf = (sources: CitedSource[]) => [...new Set(sources.map((s) => s.documentTitle))].join(", ");
const countOf = (n: number) => `${n} ${n === 1 ? "source" : "sources"}`;

export function SourcesView() {
  const wide = useMediaQuery("(min-width: 1024px)");
  return wide ? <SourcesPanel /> : <SourcesDrawer />;
}

function SourcesPanel() {
  const { shown, close } = useSources();

  // Escape closes the panel, unless something else (a dialog) is handling it
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, close]);

  if (!shown) return null;
  return (
    <aside aria-label="Sources" className="w-96 shrink-0 p-2 pl-0 duration-300 animate-in fade-in-0 slide-in-from-right-6 xl:w-[26rem]">
      <div className="glass flex h-full flex-col overflow-hidden rounded-2xl border border-glass-border bg-glass-strong">
        <div className="flex items-start gap-3 border-b border-glass-divider py-3 pr-3 pl-5">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{countOf(shown.sources.length)}</h2>
            <p className="truncate text-sm text-muted-foreground">{documentsOf(shown.sources)}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close sources" onClick={close}>
            <XIcon />
          </Button>
        </div>
        <SourceList shown={shown} className="min-h-0 flex-1 overflow-y-auto" />
      </div>
    </aside>
  );
}

function SourcesDrawer() {
  const { shown, last, close } = useSources();
  const content = shown ?? last;

  return (
    <Drawer open={!!shown} onOpenChange={(open) => !open && close()}>
      <DrawerContent className="glass border-glass-border bg-glass-strong">
        {content && (
          <>
            <DrawerHeader className="border-b border-glass-divider pt-3 text-left">
              <DrawerTitle className="font-semibold">{countOf(content.sources.length)}</DrawerTitle>
              <DrawerDescription className="truncate">{documentsOf(content.sources)}</DrawerDescription>
            </DrawerHeader>
            <SourceList shown={content} className="overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]" />
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function SourceList({ shown, className }: { shown: Shown; className?: string }) {
  const { active, focus, setActive } = useSources();
  const listRef = useRef<HTMLOListElement>(null);
  // Hovered, or else the passage that was asked for (opening the drawer moves focus off its citation)
  const activeN = active?.key === shown.key ? active.n : focus?.key === shown.key ? focus.n : null;

  // Scroll the asked-for passage into view
  useEffect(() => {
    if (!focus) return;
    listRef.current
      ?.querySelector(`[data-source="${focus.n}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focus]);

  return (
    <ol ref={listRef} className={cn("divide-y divide-glass-divider", className)}>
      {shown.sources.map((s) => (
        <li
          key={s.index}
          data-source={s.index}
          className="scroll-my-4 px-5 py-4"
          onMouseEnter={() => setActive(shown.key, s.index)}
          onMouseLeave={() => setActive(shown.key, null)}
        >
          <p className="flex items-baseline gap-2 text-sm">
            <span className="cite m-0" data-active={activeN === s.index}>
              {s.index}
            </span>
            <span className="min-w-0 truncate font-medium">{s.documentTitle}</span>
          </p>
          {s.headingPath && <p className="mt-0.5 truncate pl-7 text-xs text-muted-foreground">{s.headingPath}</p>}
          <p className="mt-2 text-[15px] leading-relaxed">
            <span className="mark" data-active={activeN === s.index}>
              {s.excerpt}
            </span>
          </p>
        </li>
      ))}
    </ol>
  );
}
