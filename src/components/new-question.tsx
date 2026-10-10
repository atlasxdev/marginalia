"use client";

import { useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { documentsQuery } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <p className="mt-3 text-muted-foreground">
          {isPending
            ? "Checking your library…"
            : ready.length > 0
              ? `Answers come from your ${ready.length} ready ${ready.length === 1 ? "document" : "documents"}, with the passage behind each one.`
              : null}
        </p>

        {!isPending && ready.length === 0 ? (
          <Card className="mt-8 py-7 [--card-spacing:--spacing(7)]">
            <CardHeader>
              <CardTitle>Your library is empty</CardTitle>
              <CardDescription>Upload a Markdown, PDF, or Word file to start asking questions.</CardDescription>
            </CardHeader>
            <div className="px-7">
              <Button asChild>
                <Link href="/library">Upload documents</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="mt-8">
              <Composer textareaRef={textareaRef} />
            </div>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Example questions">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <Button
                    type="button"
                    variant="paper"
                    onClick={() => applySuggestion(s)}
                    className="h-auto rounded-full px-3.5 py-1.5 text-left whitespace-normal"
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
