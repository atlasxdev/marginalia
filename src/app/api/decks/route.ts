import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import { NothingToMakeError, buildAction } from "@/server/actions";
import { getSpace, toAction } from "@/server/data";
import { ModelsUnavailableError } from "@/server/gemini";
import { documentTitle } from "@/server/ingest";
import { DAILY_QUESTION_LIMIT } from "@/server/rag";
import { DECK_FOCUS, deckExcerpts, isRepeat, knownCardFronts } from "@/server/study";

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

  // What's already there: the subject's cards, or for a file, the cards of every subject it's in
  let known: string[];
  if ("spaceId" in body.data) {
    known = await knownCardFronts(supabase, body.data.spaceId, documentIds);
  } else {
    const { data: links } = await supabase.from("space_documents").select("space_id").eq("document_id", body.data.documentId);
    const spaces = await Promise.all((links ?? []).map((l) => getSpace(supabase, l.space_id as string)));
    const lists = await Promise.all([
      knownCardFronts(supabase, null, documentIds),
      ...spaces.filter((s) => s !== null).map((s) => knownCardFronts(supabase, s.id, s.documentIds)),
    ]);
    known = [...new Set(lists.flat())];
  }

  let payload;
  try {
    payload = await buildAction("flashcards", {
      question: `Make a reviewer for ${name}`,
      answer: "",
      excerpts,
      focus: DECK_FOCUS,
      avoid: known,
    });
    if (known.length) {
      payload = { ...payload, cards: (payload as { cards: { front: string }[] }).cards.filter((c) => !isRepeat(c.front, known)) } as typeof payload;
      if ((payload as { cards: unknown[] }).cards.length === 0) throw new NothingToMakeError("Already covered.");
    }
  } catch (error) {
    if (error instanceof NothingToMakeError) {
      return Response.json(
        { error: known.length ? "Your reviewers already cover these notes. Add more notes to make another." : "Couldn't find enough to make cards from." },
        { status: 422 }
      );
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
