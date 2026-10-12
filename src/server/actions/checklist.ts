import "server-only";
import { z } from "zod";
import type { ChecklistItem } from "@/lib/types";
import type { ActionBuilder } from ".";

const schema = z.object({
  title: z.string().describe('A short name for the list, like "Before you move out".'),
  items: z
    .array(
      z.object({
        text: z.string().describe("One thing to do, starting with a verb."),
        due: z.string().nullable().describe("The deadline exactly as written, or null if there isn't one."),
        source: z.number().int().describe("The excerpt number it came from."),
      })
    )
    .max(15),
});

export const checklist: ActionBuilder<typeof schema, { title: string; items: ChecklistItem[] }> = {
  instructions:
    "Make a checklist of the steps, tasks or requirements the user needs to act on, in the order they'd do them. Skip background facts that aren't something to do.",
  schema,
  toPayload(raw, sourceIdOf) {
    const items = raw.items
      .map((i) => ({
        text: i.text.trim().slice(0, 200),
        due: i.due?.trim().slice(0, 60) || null,
        sourceId: sourceIdOf(i.source),
      }))
      .filter((i) => i.text && i.sourceId);
    if (items.length === 0) return null;
    return { title: raw.title.trim().slice(0, 80) || "Checklist", items };
  },
};
