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
        multi: z
          .object({
            question: z.string().describe('A select-all-that-apply question on the same idea, like "Which of these are products of glycolysis?"'),
            right: z.array(z.string()).describe("Two to four options that are all correct."),
            wrong: z.array(z.string()).describe("Two or three plausible options that are wrong."),
          })
          .nullable()
          .describe("A select-all version when the idea has several correct parts, like a list, the steps of a process, causes or features. Null otherwise."),
        source: z.number().int().describe("The excerpt number the answer came from."),
      })
    )
    .max(20),
});

const clean = (list: string[]) => [...new Set(list.map((o) => o.trim().slice(0, 200)).filter(Boolean))];

// Kept only when it's a real select-all: two or more right options and at least one wrong one, none in both
function cleanMulti(m: z.infer<typeof schema>["cards"][number]["multi"]) {
  if (!m) return undefined;
  const right = clean(m.right).slice(0, 4);
  const wrong = clean(m.wrong).filter((w) => !right.includes(w)).slice(0, 3);
  const question = m.question.trim().slice(0, 300);
  return question && right.length >= 2 && wrong.length >= 1 ? { question, right, wrong } : undefined;
}

export const flashcards: ActionBuilder<typeof schema, { title: string; cards: Flashcard[] }> = {
  instructions:
    "Make flashcards that help the user study this topic: definitions, key facts, causes and effects, steps and comparisons. Use the excerpts, not only the answer, so the deck covers the topic. One idea per card. Make between 5 and 15 cards, as many as the excerpts support. Where an idea has several correct parts (a list, steps, causes, features), also give the card a select-all version; most decks have a few.",
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
        multi: cleanMulti(c.multi),
        sourceId: sourceIdOf(c.source),
      }))
      .filter((c) => c.front && c.back && c.sourceId);
    if (cards.length === 0) return null;
    return { title: raw.title.trim().slice(0, 80) || "Flashcards", cards };
  },
};
