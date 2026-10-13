"use client";

import { useState } from "react";
import { toast } from "sonner";
import { isDue, rate as schedule } from "./leitner";
import type { CardProgress, Flashcard, FlashcardsAction, Source } from "./types";
import { saveActionState, saveAttempts, type AttemptInput } from "./writes";

/** One card in a study session, which can mix cards from several decks. */
export type StudyItem = {
  deckId: string;
  index: number;
  card: Flashcard;
  progress?: CardProgress;
  /** Where the answer comes from, like "Biology notes › Krebs cycle". */
  source: string | null;
};


export const sourceName = (source: Source) => [source.documentTitle, source.headingPath].filter(Boolean).join(" › ");

/* Keeps card progress for a set of decks while you study. Each rating and each
   answer is saved right away. */
export function useStudy(decks: FlashcardsAction[], fallbackSources: Source[] = []) {
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
    saveActionState(deck.id, { cards }).catch((error: Error) => toast.error(error.message));
  };

  // The topic comes from the card, for finding weak topics
  const saveAttempt = (attempt: Omit<AttemptInput, "topic">) => {
    const card = decks.find((d) => d.id === attempt.deckId)?.payload.cards[attempt.index];
    if (card) saveAttempts([{ ...attempt, topic: card.topic }]).catch(() => undefined);
  };

  return { items, dueItems, rate, saveAttempt, progressOf };
}
