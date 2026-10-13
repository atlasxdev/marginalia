"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isDue, rate as schedule } from "./leitner";
import type { AttemptResult, CardProgress, Flashcard, FlashcardsAction, Source } from "./types";

/** One card in a study session, which can mix cards from several decks. */
export type StudyItem = {
  deckId: string;
  index: number;
  card: Flashcard;
  progress?: CardProgress;
  /** Where the answer comes from, like "Biology notes › Krebs cycle". */
  source: string | null;
};

export type AttemptInput = { deckId: string; index: number; result: AttemptResult; mode: "cards" | "quiz" };

export const sourceName = (source: Source) => [source.documentTitle, source.headingPath].filter(Boolean).join(" › ");

async function send(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't save your progress.");
}

/* Keeps card progress for a set of decks while you study. Each rating and each
   answer is saved right away; when a session ends, pages refresh. */
export function useStudy(decks: FlashcardsAction[], fallbackSources: Source[] = []) {
  const queryClient = useQueryClient();
  const [overrides, setOverrides] = useState<Record<string, Record<string, CardProgress>>>({});

  const progressOf = (deck: FlashcardsAction) => ({ ...(deck.state.cards ?? {}), ...overrides[deck.id] });

  const items = (filter?: (item: StudyItem) => boolean): StudyItem[] =>
    decks.flatMap((deck) => {
      const progress = progressOf(deck);
      const sources = deck.payload.sources ?? fallbackSources;
      return deck.payload.cards
        .map((card, index): StudyItem => {
          const source = sources.find((s) => s.chunkId === card.sourceId);
          return { deckId: deck.id, index, card, progress: progress[index], source: source ? sourceName(source) : null };
        })
        .filter((item) => !filter || filter(item));
    });

  const dueItems = () => items((item) => isDue(item.progress));

  /** Schedules a card from whether you knew it, using its latest progress. */
  const rate = (item: StudyItem, knew: boolean) => {
    const deck = decks.find((d) => d.id === item.deckId);
    if (!deck) return;
    // Ratings come one tap at a time, so the rendered progress is current
    const progress = progressOf(deck);
    const cards = { ...progress, [item.index]: schedule(progress[item.index], knew) };
    setOverrides((o) => ({ ...o, [deck.id]: cards }));
    send(`/api/actions/${deck.id}`, { cards }, "PATCH").catch((error: Error) => toast.error(error.message));
  };

  const saveAttempt = (attempt: AttemptInput) => {
    send("/api/study/attempts", { attempts: [attempt] }).catch(() => undefined);
  };

  const finish = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["study"] }),
      queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    ]);
  };

  return { items, dueItems, rate, saveAttempt, finish, progressOf };
}
