"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpIcon } from "lucide-react";
import type { Pet, Source } from "@/lib/types";
import { sourceName } from "@/lib/use-study";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { PetSprite } from "../pet/pet-sprite";
import type { Step } from "./plan";

type Turn = { question: string; answer: string; source: string | null };

const stripCitations = (text: string) => text.replace(/\s?\[\d+(?:,\s*\d+)*\]/g, "").trim();

/** "Ask Mochi": questions about the card you're on, answered from your notes. */
export function AskSheet({
  open,
  onOpenChange,
  step,
  question,
  spaceId,
  pet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step?: Step;
  /** Asked as soon as it opens, like "explain why this is the answer". */
  question?: string;
  spaceId?: string;
  pet: Pet | null | undefined;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="glass flex w-full flex-col gap-0 border-glass-border bg-glass-strong p-0 sm:max-w-md">
        <SheetHeader className="flex-row items-center gap-3 border-b border-glass-divider p-5">
          {pet && (
            <span className="grid size-11 shrink-0 place-items-end justify-center overflow-hidden rounded-xl bg-[#e7effc] pb-1 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
              <PetSprite look={pet} face="side" book className="h-8 w-[30px]" />
            </span>
          )}
          <div className="grid min-w-0 gap-0.5 text-left">
            <SheetTitle>Ask {pet?.name ?? "your buddy"}</SheetTitle>
            <SheetDescription className="line-clamp-2">{step ? step.item.card.front : "About the card you're on"}</SheetDescription>
          </div>
        </SheetHeader>
        {/* A fresh conversation for each card */}
        {step && <Thread key={`${step.key}-${question ?? ""}`} step={step} spaceId={spaceId} first={question} />}
      </SheetContent>
    </Sheet>
  );
}

function Thread({ step, spaceId, first }: { step: Step; spaceId?: string; first?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/study/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: step.item.deckId, index: step.item.index, question, spaceId }),
      });
      const body = (await res.json().catch(() => null)) as { answer?: string; sources?: Source[]; error?: string } | null;
      if (!res.ok || !body?.answer) throw new Error(body?.error ?? "Couldn't answer that. Try again.");
      setTurns((t) => [...t, { question, answer: stripCitations(body.answer!), source: body.sources?.[0] ? sourceName(body.sources[0]) : null }]);
      setDraft("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Opened from "Explain it": ask straight away
  const askedFirst = useRef(false);
  useEffect(() => {
    if (!first || askedFirst.current) return;
    askedFirst.current = true;
    void ask(first);
    // Once, when it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first]);

  const suggestions = ["Explain this simply", "Why is that the answer?", "Give me an example"];

  return (
    <>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {turns.length === 0 && !busy && (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">Stuck? Ask anything about this card. Answers come from your notes.</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <Button key={s} variant="outline" size="sm" className="rounded-full" onClick={() => void ask(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="grid gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
            <p className="justify-self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">{t.question}</p>
            <div className="grid gap-1.5 rounded-2xl rounded-bl-md bg-foreground/5 px-3.5 py-3 text-sm">
              <p className="leading-relaxed">{t.answer}</p>
              {t.source && <p className="truncate text-xs text-muted-foreground">From {t.source}</p>}
            </div>
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Looking in your notes…
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <form
        className="flex gap-2 border-t border-glass-divider p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about this card" aria-label="Ask about this card" disabled={busy} className="h-11 rounded-xl" autoFocus />
        <Button type="submit" size="icon" className="size-11 shrink-0 rounded-xl" disabled={busy || !draft.trim()} aria-label="Ask">
          <ArrowUpIcon />
        </Button>
      </form>
    </>
  );
}
