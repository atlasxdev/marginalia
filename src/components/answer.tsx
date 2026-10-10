"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { formatResponse } from "@/lib/format-response";
import type { Source } from "@/lib/types";

type AnswerProps = {
  content: string;
  sources: Source[];
  streaming?: boolean;
};

export function Answer({ content, sources, streaming = false }: AnswerProps) {
  const { markdown, cited } = formatResponse(content, sources, streaming);
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className={`answer min-w-0 max-w-[68ch] ${streaming ? "caret" : ""}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            a: ({ href, children }) => {
              const match = href?.match(/^#cite-(\d+)$/);
              if (!match) {
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-pen underline">
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
        <aside aria-label="Sources" className="lg:border-l lg:border-rule lg:pl-6">
          <ol className="space-y-5">
            {cited.map((s) => (
              <li
                key={s.index}
                id={`cite-${s.index}`}
                className="scroll-mt-24 text-sm"
                onMouseEnter={() => setActive(s.index)}
                onMouseLeave={() => setActive(null)}
              >
                <p className="flex gap-2 text-ink-soft">
                  <span className="font-semibold text-ink tabular-nums">{s.index}</span>
                  <span>
                    <span className="font-medium text-ink">{s.documentTitle}</span>
                    <span className="block text-xs">{s.headingPath}</span>
                  </span>
                </p>
                <p className="mt-2 pl-5 font-serif text-[0.95rem] leading-relaxed">
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
