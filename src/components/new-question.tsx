"use client";

import { useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { documentsQuery } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";
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
    <div className="flex h-full flex-col justify-center px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="font-serif text-3xl leading-tight sm:text-[2.5rem]">
          What do you want to find out?
        </h1>
        <p className="mt-3 text-ink-soft">
          {isPending
            ? "Checking your library…"
            : ready.length > 0
              ? `Answers come from your ${ready.length} ready ${ready.length === 1 ? "document" : "documents"}, with the passage behind each one.`
              : null}
        </p>

        {!isPending && ready.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-rule px-6 py-8">
            <p className="font-medium">Your library is empty</p>
            <p className="mt-1 text-sm text-ink-soft">
              Upload a Markdown, PDF, or Word file to start asking questions.
            </p>
            <Link
              href="/library"
              className="mt-4 inline-block rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90"
            >
              Upload documents
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-8">
              <Composer textareaRef={textareaRef} />
            </div>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Example questions">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="rounded-full border border-rule px-3.5 py-1.5 text-left text-sm text-ink-soft transition-colors hover:border-ink-soft hover:text-ink"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
