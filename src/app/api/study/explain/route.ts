import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { FlashcardsAction } from "@/lib/types";
import { getSpace, toAction, type ActionRow } from "@/server/data";
import { ModelsUnavailableError, generateChat } from "@/server/gemini";
import { DAILY_QUESTION_LIMIT, buildContents, retrieve, systemPrompt, toSources } from "@/server/rag";

const bodySchema = z.object({
  deckId: z.uuid(),
  index: z.number().int().min(0).max(99),
  question: z.string().trim().min(1).max(500),
  spaceId: z.uuid().optional(),
});

/* "Ask about this card" in a study session: a short answer from the subject's
   notes (or, outside a subject, from the file the card came from), cited. */
export async function POST(req: Request) {
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Ask a question about the card." }, { status: 400 });

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const { data: row } = await supabase
    .from("actions")
    .select("id, message_id, kind, payload, state, created_at")
    .eq("id", body.data.deckId)
    .eq("kind", "flashcards")
    .maybeSingle();
  const card = row && (toAction(row as ActionRow) as FlashcardsAction).payload.cards[body.data.index];
  if (!card) return Response.json({ error: "That card wasn't found." }, { status: 404 });

  // Search the subject's notes; without one, the card's own file
  const space = body.data.spaceId ? await getSpace(supabase, body.data.spaceId) : null;
  let documentIds = space?.documentIds;
  if (!documentIds?.length && card.sourceId) {
    const { data: chunk } = await supabase.from("chunks").select("document_id").eq("id", Number(card.sourceId)).maybeSingle();
    if (chunk) documentIds = [chunk.document_id as string];
  }

  const { data: allowed } = await admin.rpc("consume_question", { p_user_id: userId, p_limit: DAILY_QUESTION_LIMIT });
  if (!allowed) {
    return Response.json({ error: `You've used your ${DAILY_QUESTION_LIMIT} questions for today. Try again tomorrow.` }, { status: 429 });
  }

  try {
    const rows = await retrieve(supabase, `${card.front} ${body.data.question}`, documentIds);
    if (rows.length === 0) return Response.json({ answer: "I couldn't find anything about that in your notes.", sources: [] });
    const question = `The student is studying this flashcard.\nQuestion: ${card.front}\nAnswer: ${card.back}\n\nTheir question about it: ${body.data.question}\n\nAnswer in two or three short sentences.`;
    const answer = await generateChat(systemPrompt(space?.instructions), buildContents(question, [], rows));
    return Response.json({ answer, sources: toSources(rows) });
  } catch (error) {
    console.error("Explain failed:", error);
    return Response.json(
      { error: error instanceof ModelsUnavailableError ? "The AI models are busy or out of free quota for today. Try again later." : "Couldn't answer that. Try again." },
      { status: 503 }
    );
  }
}
