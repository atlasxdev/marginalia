"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LayersIcon } from "lucide-react";
import { documentsQuery, spacesQuery } from "@/lib/queries";
import { useCreateSpace } from "@/lib/use-create-space";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Composer } from "./composer";

const ALL = "all";
// With this many documents, grouping them into a space starts to pay off
const SPACE_NUDGE_AT = 10;

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
  const spacesResult = useQuery(spacesQuery);
  const spaces = (hydrated ? spacesResult.data : undefined) ?? [];
  const [scope, setScope] = useState(ALL);
  const space = spaces.find((s) => s.id === scope);
  const spaceReady = space ? ready.filter((d) => space.documentIds.includes(d.id)) : ready;
  const createSpace = useCreateSpace();

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
            : space
              ? spaceReady.length > 0
                ? `Searching ${spaceReady.length} ${spaceReady.length === 1 ? "document" : "documents"} in ${space.name}.`
                : `${space.name} has no documents ready yet.`
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
              <Composer
                key={scope}
                textareaRef={textareaRef}
                spaceId={space?.id}
                placeholder={space ? `Ask ${space.name}` : undefined}
                busy={!!space && space.documentIds.length === 0}
              />
            </div>
            {/* What to search: everything, or one space */}
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span id="scope-label">Search</span>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger aria-labelledby="scope-label" size="sm" className="glass border-glass-border bg-glass text-foreground">
                  <LayersIcon className="text-primary" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass border border-glass-border bg-glass-strong">
                  <SelectItem value={ALL}>All documents</SelectItem>
                  {spaces.length > 0 && <SelectSeparator />}
                  {spaces.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {spaces.length === 0 && ready.length >= SPACE_NUDGE_AT && (
              <p className="mt-3 text-sm text-muted-foreground">
                Lots of documents?{" "}
                <Button variant="link" className="h-auto p-0" disabled={createSpace.isPending} onClick={() => createSpace.mutate()}>
                  Group them into a space
                </Button>{" "}
                for more focused answers.
              </p>
            )}
            <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Example questions">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <Button
                    type="button"
                    variant="glass"
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
