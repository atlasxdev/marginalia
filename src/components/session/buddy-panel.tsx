"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpIcon } from "lucide-react";
import { petQuery } from "@/lib/queries";
import type { Source } from "@/lib/types";
import { sourceName } from "@/lib/use-study";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PetSprite, type Face } from "../pet/pet-sprite";
import type { Step } from "./plan";

export type Reaction = { face: Face; line: string; seq: number };

/** Your buddy at the desk with you: it reads along, reacts to each answer, and explains a card when you ask. */
export function BuddyPanel({ reaction, step, spaceId, resting = false }: { reaction: Reaction | null; step?: Step; spaceId?: string; resting?: boolean }) {
  const pet = useQuery(petQuery).data;
  const face: Face = resting ? "closed" : (reaction?.face ?? "side");
  const line = reaction?.line ?? (resting ? "Stretching. Back in a bit." : "Reading along with you.");

  return (
    <aside className="glass flex flex-col gap-4 rounded-3xl border border-glass-border bg-glass p-5">
      <div className="flex items-center gap-4 xl:flex-col xl:items-stretch">
        <div className="grid size-16 shrink-0 place-items-end justify-center overflow-hidden rounded-2xl bg-[#e7effc] pb-1.5 ring-1 ring-foreground/10 xl:h-40 xl:w-full xl:pb-5 dark:bg-[#2b354a]">
          {pet && (
            <PetSprite
              key={reaction?.seq ?? 0}
              look={pet}
              face={face}
              book={face === "side"}
              className={cn(
                "h-[50px] w-12 origin-bottom xl:h-24 xl:w-[90px]",
                face === "happy" && "animate-[pet-hop_400ms_ease-out] motion-reduce:animate-none",
                face === "flat" && "animate-[pet-squash_400ms_ease-out] motion-reduce:animate-none",
                face === "side" && "animate-[pet-read_2.4s_ease-in-out_infinite] motion-reduce:animate-none"
              )}
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{pet?.name ?? "Your buddy"}</p>
          <p key={reaction?.seq} className="text-sm text-muted-foreground animate-in fade-in duration-150 motion-reduce:animate-none">
            {line}
          </p>
        </div>
      </div>
      {step && <AskAboutCard key={step.key} step={step} spaceId={spaceId} />}
    </aside>
  );
}

function stripCitations(text: string) {
  return text.replace(/\s?\[\d+(?:,\s*\d+)*\]/g, "").trim();
}

function AskAboutCard({ step, spaceId }: { step: Step; spaceId?: string }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<{ answer: string; sources: Source[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (!question.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/study/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: step.item.deckId, index: step.item.index, question, spaceId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Couldn't answer that. Try again.");
      setReply(body);
      setQuestion("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 border-t border-glass-divider pt-4">
      <p className="text-sm font-medium">Stuck on this card?</p>
      {reply && (
        <div className="grid gap-1.5 rounded-2xl bg-glass-strong p-3 text-sm animate-in fade-in duration-200 motion-reduce:animate-none">
          <p className="leading-relaxed">{stripCitations(reply.answer)}</p>
          {reply.sources[0] && <p className="truncate text-xs text-muted-foreground">From {sourceName(reply.sources[0])}</p>}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this card"
          aria-label="Ask about this card"
          disabled={busy}
          className="h-10 rounded-xl"
        />
        <Button type="submit" size="icon" className="size-10 shrink-0 rounded-xl" disabled={busy || !question.trim()} aria-label="Ask">
          {busy ? <Spinner /> : <ArrowUpIcon />}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
