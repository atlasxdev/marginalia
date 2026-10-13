import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import { ModelsUnavailableError } from "@/server/gemini";
import { DAILY_QUESTION_LIMIT } from "@/server/rag";
import { cardWithPassage, checkTeachBack } from "@/server/study";

const bodySchema = z.object({
  deckId: z.uuid(),
  index: z.number().int().min(0).max(99),
  explanation: z.string().trim().min(1).max(1500),
});

// Checks your own explanation of a card you misunderstood (explaining it back).
export async function POST(req: Request) {
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Explain it in your own words first." }, { status: 400 });

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const found = await cardWithPassage(supabase, body.data.deckId, body.data.index);
  if (!found) return Response.json({ error: "That card wasn't found." }, { status: 404 });

  const { data: allowed } = await admin.rpc("consume_question", { p_user_id: userId, p_limit: DAILY_QUESTION_LIMIT });
  if (!allowed) {
    return Response.json({ error: `You've used your ${DAILY_QUESTION_LIMIT} questions for today. Try again tomorrow.` }, { status: 429 });
  }

  try {
    const result = await checkTeachBack(found.card, found.passage, body.data.explanation);
    if (!result) return Response.json({ error: "Couldn't check that. Try again." }, { status: 503 });
    return Response.json(result);
  } catch (error) {
    console.error("Teach-back failed:", error);
    return Response.json(
      { error: error instanceof ModelsUnavailableError ? "The AI models are busy or out of free quota for today. Try again later." : "Couldn't check that. Try again." },
      { status: 503 }
    );
  }
}
