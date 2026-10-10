"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Card, cardVariants } from "@/components/ui/card";
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
    <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <Card className={cn("answer block min-w-0 self-start px-6 py-6 text-[1.0625rem] sm:px-9 sm:py-8", streaming && "caret")}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            a: ({ href, children }) => {
              const match = href?.match(/^#cite-(\d+)$/);
              if (!match) {
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-ring underline">
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
      </Card>

      {cited.length > 0 && (
        <aside aria-label="Sources" className="lg:pt-3">
          <ol className="space-y-4">
            {cited.map((s, i) => (
              <li
                key={s.index}
                id={`cite-${s.index}`}
                data-active={active === s.index}
                style={{ "--tilt": i % 2 ? "0.6deg" : "-0.5deg" } as React.CSSProperties}
                className={cn(cardVariants({ variant: "index" }), "scroll-mt-24 gap-0 py-0")}
                onMouseEnter={() => setActive(s.index)}
                onMouseLeave={() => setActive(null)}
              >
                {/* Ruled header line, like a real index card */}
                <p className="flex gap-2 border-b border-destructive/35 px-4 pt-3 pb-2 text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">{s.index}</span>
                  <span>
                    <span className="font-medium text-foreground">{s.documentTitle}</span>
                    <span className="block text-xs">{s.headingPath}</span>
                  </span>
                </p>
                <p className="px-4 pt-2.5 pb-4 font-serif text-[0.95rem] leading-relaxed">
                  <span className="mark" data-active={active === s.index}>
                    {s.excerpt}
                  </span>
                </p>
              </li>
            ))}
          </ol>
        </aside>
      )}
    </div>
  );
}
