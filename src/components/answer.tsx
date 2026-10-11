"use client";

import { createContext, use } from "react";
import { ChevronRightIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { formatResponse } from "@/lib/format-response";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSources } from "./sources";

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
  /** Names this answer in the sources view. */
  id: string;
  content: string;
  sources: Source[];
  streaming?: boolean;
};

export function Answer({ id, content, sources, streaming = false }: AnswerProps) {
  const { markdown, cited } = formatResponse(content, sources, streaming);
  const view = useSources();
  const open = view.shown?.key === id;
  const active = view.active?.key === id ? view.active.n : view.focus?.key === id ? view.focus.n : null;
  const documents = [...new Set(cited.map((s) => s.documentTitle))];

  const cite: CiteState = {
    active,
    setActive: (n) => view.setActive(id, n),
    // A citation opens the sources at its passage
    showSource: (n) => view.show(id, cited, n),
  };

  return (
    <CiteContext value={cite}>
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
        <button
          type="button"
          aria-expanded={open}
          onClick={() => (open ? view.close() : view.show(id, cited))}
          className="glass mt-6 flex w-full items-center gap-3 rounded-xl border border-glass-border bg-glass px-4 py-3 text-left text-sm transition-colors hover:bg-glass-strong focus-visible:bg-glass-strong focus-visible:outline-none aria-expanded:bg-glass-strong aria-expanded:ring-2 aria-expanded:ring-primary/40"
        >
          <span className="font-semibold">
            {cited.length} {cited.length === 1 ? "source" : "sources"}
          </span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {documents.join(", ")}
          </span>
          <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}
    </CiteContext>
  );
}
