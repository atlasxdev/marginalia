"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { formatResponse } from "@/lib/format-response";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

type AnswerProps = {
  content: string;
  sources: Source[];
  streaming?: boolean;
};

export function Answer({ content, sources, streaming = false }: AnswerProps) {
  const { markdown, cited } = formatResponse(content, sources, streaming);
  const [active, setActive] = useState<number | null>(null);

  return (
    <div>
      <div className={cn("answer min-w-0", streaming && "caret")}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            a: ({ href, children }) => {
              const match = href?.match(/^#cite-(\d+)$/);
              if (!match) {
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {children}
                  </a>
                );
              }
              const n = Number(match[1]);
              return (
                <a
                  href={href}
                  className="cite"
                  data-active={active === n}
                  aria-label={`Source ${n}`}
                  onMouseEnter={() => setActive(n)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(n)}
                  onBlur={() => setActive(null)}
                >
                  {n}
                </a>
              );
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>

      {cited.length > 0 && (
        <section aria-label="Sources" className="mt-6">
          <h3 className="mb-2 px-4 text-xs font-semibold text-muted-foreground">Sources</h3>
          <ol className="glass border border-glass-border bg-glass divide-y divide-glass-divider overflow-hidden rounded-xl">
            {cited.map((s) => (
              <li
                key={s.index}
                id={`cite-${s.index}`}
                className="scroll-mt-24 px-4 py-3"
                onMouseEnter={() => setActive(s.index)}
                onMouseLeave={() => setActive(null)}
              >
                <p className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold tabular-nums">{s.index}</span>
                  <span className="font-medium">{s.documentTitle}</span>
                  <span className="truncate text-muted-foreground">{s.headingPath}</span>
                </p>
                <p className="mt-1 pl-4 text-[15px] leading-relaxed">
                  <span className="mark" data-active={active === s.index}>
                    {s.excerpt}
                  </span>
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
