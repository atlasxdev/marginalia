"use client";

import { createContext, Fragment, use, useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CitedSource } from "@/lib/format-response";
import { useMediaQuery } from "@/lib/use-media-query";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { cn } from "@/lib/utils";
import { SmartLink } from "./smart-link";

/*
 * One conversation's sources view: a sheet from the right on a wide screen,
 * a drawer from the bottom below lg. `key` names the answer whose sources are shown, so
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
  const { shown, last, close } = useSources();
  const content = shown ?? last;

  return (
    <Sheet open={!!shown} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="glass gap-0 border-glass-border bg-glass-strong p-0 data-[side=right]:sm:max-w-lg">
        {content && (
          <>
            <SheetHeader className="border-b border-glass-divider py-3 pr-12 pl-5">
              <SheetTitle className="font-semibold">{countOf(content.sources.length)}</SheetTitle>
              <SheetDescription className="truncate">{documentsOf(content.sources)}</SheetDescription>
            </SheetHeader>
            <SourceList shown={content} className="min-h-0 flex-1 overflow-y-auto" />
          </>
        )}
      </SheetContent>
    </Sheet>
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

/*
 * A passage is a chunk of the original file, so a Markdown file's passage is
 * Markdown: render it, with the highlight on each block's text. Whether it's
 * the active passage comes from context, so the components stay stable.
 */
const MarkActive = createContext(false);
function Marked({ children }: { children?: React.ReactNode }) {
  return (
    <span className="mark" data-active={use(MarkActive)}>
      {children}
    </span>
  );
}
const heading = ({ children }: { children?: React.ReactNode }) => (
  <p className="font-semibold">
    <Marked>{children}</Marked>
  </p>
);
const excerptComponents: Components = {
  p: ({ children }) => (
    <p>
      <Marked>{children}</Marked>
    </p>
  ),
  li: ({ children }) => (
    <li>
      <Marked>{children}</Marked>
    </li>
  ),
  td: ({ children }) => (
    <td>
      <Marked>{children}</Marked>
    </td>
  ),
  th: ({ children }) => (
    <th>
      <Marked>{children}</Marked>
    </th>
  ),
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,
  a: SmartLink,
  // Badges and screenshots aren't worth the room in a passage
  img: () => null,
};

function Excerpt({ text, active }: { text: string; active: boolean }) {
  return (
    <MarkActive value={active}>
      <div className="answer doc excerpt mt-2">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={excerptComponents}>
          {text}
        </ReactMarkdown>
      </div>
    </MarkActive>
  );
}

function SourceList({ shown, className }: { shown: Shown; className?: string }) {
  const { active, focus, setActive } = useSources();
  const listRef = useRef<HTMLDivElement>(null);
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
    <ItemGroup ref={listRef} role="list" className={cn("gap-0", className)}>
      {shown.sources.map((s, i) => (
        <Fragment key={s.index}>
          {i > 0 && <ItemSeparator className="my-0 bg-glass-divider" />}
          <Item
            role="listitem"
            data-source={s.index}
            className="scroll-my-4 items-start rounded-none px-6 py-5"
            onMouseEnter={() => setActive(shown.key, s.index)}
            onMouseLeave={() => setActive(shown.key, null)}
          >
            <ItemMedia>
              <span className="cite m-0" data-active={activeN === s.index}>
                {s.index}
              </span>
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="block truncate">{s.documentTitle}</ItemTitle>
              {s.headingPath && <ItemDescription className="truncate text-xs">{s.headingPath}</ItemDescription>}
              <Excerpt text={s.excerpt} active={activeN === s.index} />
            </ItemContent>
          </Item>
        </Fragment>
      ))}
    </ItemGroup>
  );
}
