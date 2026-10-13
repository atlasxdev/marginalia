import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { FlashcardsAction } from "@/lib/types";
import { toAction, type ActionRow } from "@/lib/data";
import { ModelsUnavailableError } from "@/server/gemini";
import { DAILY_QUESTION_LIMIT } from "@/server/rag";
import { checkAnswers, type CheckItem } from "@/server/study";

const bodySchema = z.object({
  items: z
    .array(z.object({ deckId: z.uuid(), index: z.number().int().min(0).max(99), answer: z.string().max(1000) }))
    .min(1)
    .max(10),
});

// Checks typed answers against the notes in one go, then saves each as an attempt.
export async function POST(req: Request) {
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid answers." }, { status: 400 });

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const deckIds = [...new Set(body.data.items.map((i) => i.deckId))];
  const { data: rows } = await supabase
    .from("actions")
    .select("id, message_id, kind, payload, state, created_at")
    .eq("kind", "flashcards")
    .in("id", deckIds);
  const decks = new Map(((rows ?? []) as ActionRow[]).map((r) => [r.id, toAction(r) as FlashcardsAction]));
  const valid = body.data.items.filter((i) => decks.get(i.deckId)?.payload.cards[i.index]);
  if (valid.length === 0) return Response.json({ error: "Those cards weren't found." }, { status: 404 });

  const { data: allowed } = await admin.rpc("consume_question", { p_user_id: userId, p_limit: DAILY_QUESTION_LIMIT });
  if (!allowed) {
    return Response.json(
      { error: `You've used your ${DAILY_QUESTION_LIMIT} questions for today. Try again tomorrow.` },
      { status: 429 }
    );
  }

  // The passage each card came from, to mark against
  const cardOf = (i: { deckId: string; index: number }) => decks.get(i.deckId)!.payload.cards[i.index];
  const chunkIds = [...new Set(valid.map((i) => cardOf(i).sourceId).filter((id): id is string => !!id))];
  const { data: chunks } = await supabase.from("chunks").select("id, content").in("id", chunkIds.map(Number));
  const passageOf = new Map((chunks ?? []).map((c) => [String(c.id), c.content as string]));

  const items: CheckItem[] = valid.map((i) => {
    const card = cardOf(i);
    return {
      deck: decks.get(i.deckId)!,
      index: i.index,
      answer: i.answer,
      passage: (card.sourceId && passageOf.get(card.sourceId)) || card.back,
    };
  });

  let results;
  try {
    results = await checkAnswers(items);
  } catch (error) {
    console.error("Checking answers failed:", error);
    return Response.json(
      {
        error:
          error instanceof ModelsUnavailableError
            ? "The AI models are busy or out of free quota for today. Try again later."
            : "Couldn't check your answers. Try again.",
      },
      { status: 503 }
    );
  }

  const { error } = await supabase.from("attempts").insert(
    results.map((r) => ({
      action_id: r.deckId,
      card_index: r.index,
      topic: cardOf(r).topic ?? "",
      result: r.result,
      mode: "recall",
    }))
  );
  if (error) console.error("Saving checked answers failed:", error);
  return Response.json(results);
}
