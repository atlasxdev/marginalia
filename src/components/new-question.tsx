"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LayersIcon, PlusIcon } from "lucide-react";
import { documentsQuery, spacesQuery } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Composer } from "./composer";
import { SpaceDialog } from "./space-dialog";

const ALL = "all";

const MAX_SUGGESTIONS = 3;

// One question from each of the newest documents first, so the picks cover different files
function pickSuggestions(documents: { suggestedQuestions: string[] }[]) {
  const picked: string[] = [];
  for (let round = 0; picked.length < MAX_SUGGESTIONS && round < MAX_SUGGESTIONS; round++) {
    for (const doc of documents) {
      const q = doc.suggestedQuestions[round];
      if (q && !picked.includes(q)) picked.push(q);
      if (picked.length === MAX_SUGGESTIONS) break;
    }
  }
  return picked;
}

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
  const [creating, setCreating] = useState(false);
  const suggestions = pickSuggestions(spaceReady);

  function applySuggestion(text: string) {
    const el = textareaRef.current;
    if (!el) return;
    el.value = text;
    el.focus();
  }

  return (
    <div className="flex h-full flex-col justify-center px-5 sm:px-8 lg:px-12 py-14">
      <div className="mx-auto w-full max-w-4xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Ask your documents</h1>
        <p className="mt-4 text-muted-foreground">
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
          <div className="mt-10">
            <p className="text-muted-foreground">Upload a Markdown, PDF, or Word file to get started.</p>
            <Button asChild size="lg" className="mt-4">
              <Link href="/library">Upload documents</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-10">
              <Composer
                key={scope}
                textareaRef={textareaRef}
                spaceId={space?.id}
                placeholder={space ? `Ask ${space.name}` : undefined}
                busy={!!space && space.documentIds.length === 0}
              />
            </div>
            {/* What to search: everything, or one space */}
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span id="scope-label">Search</span>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger
                  aria-labelledby="scope-label"
                  size="sm"
                  className="glass border-glass-border bg-glass text-foreground"
                >
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
              {/* Want this chat to search only certain documents? Make a space for it */}
              <Button variant="ghost" size="sm" onClick={() => setCreating(true)} className="text-primary">
                <PlusIcon />
                New space
              </Button>
              <SpaceDialog open={creating} onOpenChange={setCreating} onSaved={setScope} />
            </div>
            {suggestions.length > 0 && (
              <ul className="mt-8 flex flex-wrap justify-center gap-2.5" aria-label="Questions your documents can answer">
                {suggestions.map((s) => (
                  <li key={s}>
                    <Button
                      type="button"
                      variant="glass"
                      onClick={() => applySuggestion(s)}
                      className="h-auto rounded-full px-4 py-2 font-normal whitespace-normal"
                    >
                      {s}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
