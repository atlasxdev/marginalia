"use client";

import { useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { documentsQuery } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Composer } from "./composer";

const SUGGESTIONS = [
  "What's the refund window for digital products?",
  "How do I request annual leave?",
  "What do I need to set up on my laptop in week one?",
];

export function NewQuestion() {
  const query = useQuery(documentsQuery);
  const hydrated = useHydrated();
  const documents = hydrated ? query.data : undefined;
  const isPending = !hydrated || query.isPending;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ready = documents?.filter((d) => d.status === "ready") ?? [];

  function applySuggestion(text: string) {
    const el = textareaRef.current;
    if (!el) return;
    el.value = text;
    el.focus();
  }

  return (
    <div className="flex h-full flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Ask your documents</h1>
        <p className="mt-3 text-muted-foreground">
          {isPending
            ? "Checking your library…"
            : ready.length > 0
              ? `${ready.length} ${ready.length === 1 ? "document" : "documents"} ready. Every answer shows its source.`
              : null}
        </p>

        {!isPending && ready.length === 0 ? (
          <div className="mt-8">
            <p className="text-muted-foreground">Upload a Markdown, PDF, or Word file to get started.</p>
            <Button asChild size="lg" className="mt-4">
              <Link href="/library">Upload documents</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-8">
              <Composer textareaRef={textareaRef} />
            </div>
            <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Example questions">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => applySuggestion(s)}
                    className="h-auto rounded-full px-3.5 py-1.5 font-normal whitespace-normal"
                  >
                    {s}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
