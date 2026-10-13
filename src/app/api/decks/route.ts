import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import { NothingToMakeError, buildAction } from "@/server/actions";
import { getSpace, toAction } from "@/server/data";
import { ModelsUnavailableError } from "@/server/gemini";
import { documentTitle } from "@/server/ingest";
import { DAILY_QUESTION_LIMIT } from "@/server/rag";
import { DECK_FOCUS, deckExcerpts } from "@/server/study";

const bodySchema = z.union([z.object({ documentId: z.uuid() }), z.object({ spaceId: z.uuid() })]);

// Makes a reviewer (a flashcard deck) from a whole document or subject.
export async function POST(req: Request) {
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Pick a document or subject." }, { status: 400 });

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  let documentIds: string[];
  let name: string;
  if ("spaceId" in body.data) {
    const space = await getSpace(supabase, body.data.spaceId);
    if (!space) return Response.json({ error: "Subject not found." }, { status: 404 });
    documentIds = space.documentIds;
    name = space.name;
  } else {
    const { data: doc } = await supabase
      .from("documents")
      .select("id, filename, status")
      .eq("id", body.data.documentId)
      .maybeSingle();
    if (!doc) return Response.json({ error: "Document not found." }, { status: 404 });
    if (doc.status !== "ready") {
      return Response.json({ error: "This document is still being read. Try again in a moment." }, { status: 409 });
    }
    documentIds = [doc.id];
    name = documentTitle(doc.filename);
  }

  const excerpts = await deckExcerpts(supabase, documentIds);
  if (excerpts.length === 0) {
    return Response.json({ error: "There's nothing to make cards from yet. Add documents first." }, { status: 409 });
  }

  const { data: allowed } = await admin.rpc("consume_question", { p_user_id: userId, p_limit: DAILY_QUESTION_LIMIT });
  if (!allowed) {
    return Response.json(
      { error: `You've used your ${DAILY_QUESTION_LIMIT} questions for today. Try again tomorrow.` },
      { status: 429 }
    );
  }

  let payload;
  try {
    payload = await buildAction("flashcards", {
      question: `Make a reviewer for ${name}`,
      answer: "",
      excerpts,
      focus: DECK_FOCUS,
    });
  } catch (error) {
    if (error instanceof NothingToMakeError) {
      return Response.json({ error: "Couldn't find enough to make cards from." }, { status: 422 });
    }
    console.error("Deck failed:", error);
    return Response.json(
      {
        error:
          error instanceof ModelsUnavailableError
            ? "The AI models are busy or out of free quota for today. Try again later."
            : "Something went wrong. Try again.",
      },
      { status: 503 }
    );
  }

  const origin = "spaceId" in body.data ? { space_id: body.data.spaceId } : { document_id: body.data.documentId };
  const { data: row, error } = await supabase
    .from("actions")
    .insert({ kind: "flashcards", payload, ...origin })
    .select("id, message_id, document_id, space_id, kind, payload, state, created_at")
    .single();
  if (error) {
    console.error("Saving deck failed:", error);
    return Response.json({ error: "Couldn't save the reviewer. Try again." }, { status: 500 });
  }
  return Response.json(toAction(row));
}
