"use client";

import { createContext, use, useId, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatResponse } from "@/lib/format-response";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

// Citations read hover state from context so the markdown components stay stable.
// Recreating them on every hover would remount the link mid-click.
type CiteState = {
  active: number | null;
  setActive: (n: number | null) => void;
  showSource: (n: number) => void;
};
const CiteContext = createContext<CiteState | null>(null);

function MarkdownLink({ href, children }: React.ComponentProps<"a">) {
  const cite = use(CiteContext);
  const match = href?.match(/^#cite-(\d+)$/);
  if (!match || !cite) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {children}
      </a>
    );
  }
  const n = Number(match[1]);
  return (
    <a
      href={href}
      className="cite"
      data-active={cite.active === n}
      aria-label={`Show source ${n}`}
      onClick={(e) => {
        e.preventDefault();
        cite.showSource(n);
      }}
      onMouseEnter={() => cite.setActive(n)}
      onMouseLeave={() => cite.setActive(null)}
      onFocus={() => cite.setActive(n)}
      onBlur={() => cite.setActive(null)}
    >
      {n}
    </a>
  );
}

const components = { a: MarkdownLink };

type AnswerProps = {
  content: string;
  sources: Source[];
  streaming?: boolean;
};

export function Answer({ content, sources, streaming = false }: AnswerProps) {
  const { markdown, cited } = formatResponse(content, sources, streaming);
  const [active, setActive] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const uid = useId();
  const documents = [...new Set(cited.map((s) => s.documentTitle))];

  // A citation opens the sources and scrolls to its passage
  function showSource(n: number) {
    setOpen(true);
    setActive(n);
    requestAnimationFrame(() =>
      document
        .getElementById(`cite-${n}-${uid}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  }

  return (
    <CiteContext value={{ active, setActive, showSource }}>
      <div className={cn("answer min-w-0", streaming && "caret")}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={components}
        >
          {markdown}
        </ReactMarkdown>
      </div>

      {cited.length > 0 && (
        <Collapsible
          open={open}
          onOpenChange={setOpen}
          className="glass mt-6 overflow-hidden rounded-xl border border-glass-border bg-glass"
        >
          <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-glass-strong focus-visible:bg-glass-strong focus-visible:outline-none">
            <span className="font-semibold">
              {cited.length} {cited.length === 1 ? "source" : "sources"}
            </span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {documents.join(", ")}
            </span>
            <ChevronDownIcon
              aria-hidden
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <ol className="divide-y divide-glass-divider border-t border-glass-divider">
              {cited.map((s) => (
                <li
                  key={s.index}
                  id={`cite-${s.index}-${uid}`}
                  className="scroll-mt-24 scroll-mb-36 px-4 py-3"
                  onMouseEnter={() => setActive(s.index)}
                  onMouseLeave={() => setActive(null)}
                >
                  <p className="flex items-baseline gap-2 text-sm">
                    <span className="font-semibold tabular-nums">
                      {s.index}
                    </span>
                    <span className="font-medium">{s.documentTitle}</span>
                    <span className="truncate text-muted-foreground">
                      {s.headingPath}
                    </span>
                  </p>
                  <p className="mt-1 pl-4 text-[15px] leading-relaxed">
                    <span className="mark" data-active={active === s.index}>
                      {s.excerpt}
                    </span>
                  </p>
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      )}
    </CiteContext>
  );
}
