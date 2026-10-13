import "server-only";
import { z } from "zod";
import type { Flashcard } from "@/lib/types";
import type { ActionBuilder } from ".";

const schema = z.object({
  title: z.string().describe('A short name for the deck, like "Cell respiration".'),
  cards: z
    .array(
      z.object({
        front: z.string().describe("A question that tests one fact or idea."),
        back: z.string().describe("The answer, in under 20 words."),
        topic: z
          .string()
          .describe('The concept it tests, in 1 to 4 words, like "Krebs cycle". Use the same wording for cards on the same concept.'),
        wrong: z
          .array(z.string())
          .describe("Three plausible but wrong answers, about as long as the right one, for a multiple-choice quiz."),
        source: z.number().int().describe("The excerpt number the answer came from."),
      })
    )
    .max(20),
});

export const flashcards: ActionBuilder<typeof schema, { title: string; cards: Flashcard[] }> = {
  instructions:
    "Make flashcards that help the user study this topic: definitions, key facts, causes and effects, steps and comparisons. Use the excerpts, not only the answer, so the deck covers the topic. One idea per card. Make between 5 and 15 cards, as many as the excerpts support.",
  schema,
  toPayload(raw, sourceIdOf) {
    const cards = raw.cards
      .map((c) => ({
        front: c.front.trim().slice(0, 300),
        back: c.back.trim().slice(0, 300),
        topic: c.topic.trim().slice(0, 80),
        wrong: [...new Set(c.wrong.map((w) => w.trim().slice(0, 300)))]
          .filter((w) => w && w.toLowerCase() !== c.back.trim().toLowerCase())
          .slice(0, 3),
        sourceId: sourceIdOf(c.source),
      }))
      .filter((c) => c.front && c.back && c.sourceId);
    if (cards.length === 0) return null;
    return { title: raw.title.trim().slice(0, 80) || "Flashcards", cards };
  },
};
