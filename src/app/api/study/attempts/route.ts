import { z } from "zod";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Flashcard } from "@/lib/types";

const bodySchema = z.object({
  attempts: z
    .array(
      z.object({
        deckId: z.uuid(),
        index: z.number().int().min(0).max(99),
        result: z.enum(["right", "almost", "wrong"]),
        mode: z.enum(["cards", "quiz"]),
      })
    )
    .min(1)
    .max(200),
});

// Saves how a flip or quiz session went, card by card. Typed answers are saved when they're checked.
export async function POST(req: Request) {
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid attempts." }, { status: 400 });

  const supabase = await createClient();
  if (!(await getUserId(supabase))) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  // Topics come from the saved cards, not the request
  const deckIds = [...new Set(body.data.attempts.map((a) => a.deckId))];
  const { data: decks } = await supabase.from("actions").select("id, payload").eq("kind", "flashcards").in("id", deckIds);
  const cardsOf = new Map((decks ?? []).map((d) => [d.id as string, (d.payload as { cards: Flashcard[] }).cards]));

  const rows = body.data.attempts.flatMap((a) => {
    const card = cardsOf.get(a.deckId)?.[a.index];
    return card ? [{ action_id: a.deckId, card_index: a.index, topic: card.topic ?? "", result: a.result, mode: a.mode }] : [];
  });
  if (rows.length === 0) return new Response(null, { status: 204 });
  const { error } = await supabase.from("attempts").insert(rows);
  if (error) return Response.json({ error: "Couldn't save your progress." }, { status: 500 });
  return new Response(null, { status: 204 });
}
