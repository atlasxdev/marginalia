import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Flashcard, Source } from "@/lib/types";
import { NothingToMakeError, buildAction, type Excerpt } from "@/server/actions";
import { getSpace, toAction } from "@/lib/data";
import { ModelsUnavailableError } from "@/server/gemini";
import { documentTitle } from "@/lib/data";
import { DAILY_QUESTION_LIMIT } from "@/server/rag";
import { deckExcerpts, deckPartFocus, isRepeat, knownCardFronts } from "@/server/study";

const bodySchema = z.union([z.object({ documentId: z.uuid() }), z.object({ spaceId: z.uuid() })]);

type FlashcardsPayload = { title: string; cards: Flashcard[]; sources: Source[] };

type Part = { excerpts: Excerpt[]; focus: string };

// Up to three runs of neighbouring excerpts; a short note, too small to split, is read whole by two parts with different angles
const MAX_PARTS = 3;
function splitExcerpts(excerpts: Excerpt[]): Part[] {
  if (excerpts.length < 4) {
    return [
      { excerpts, focus: deckPartFocus(2, "facts") },
      { excerpts, focus: deckPartFocus(2, "processes") },
    ];
  }
  const count = Math.min(MAX_PARTS, Math.floor(excerpts.length / 4));
  const size = Math.ceil(excerpts.length / count);
  return Array.from({ length: count }, (_, i) => excerpts.slice(i * size, (i + 1) * size))
    .filter((p) => p.length)
    .map((p, _, all) => ({ excerpts: p, focus: deckPartFocus(all.length) }));
}

// Makes a reviewer (a flashcard deck) from a whole document or subject, streaming its progress.
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

  /* The excerpts are split into parts made at the same time, so a deck takes
     about as long as one short reply. The deck is saved when the first part is
     back and grows as the rest arrive; each step is streamed as a line of JSON. */
  const parts = splitExcerpts(excerpts);
  const origin = "spaceId" in body.data ? { space_id: body.data.spaceId } : { document_id: body.data.documentId };
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: object) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      let deck: { id: string; payload: FlashcardsPayload } | null = null;
      let failure: unknown = null;
      // Parts finish in any order; saving waits its turn so two parts never write at once
      let saving = Promise.resolve();

      await Promise.all(
        parts.map((part) =>
          buildAction("flashcards", { question: `Make a reviewer for ${name}`, answer: "", excerpts: part.excerpts, focus: part.focus, avoid: known })
            .then((raw) => {
              saving = saving.then(async () => {
                const made = raw as FlashcardsPayload;
                const seen = [...known, ...(deck?.payload.cards.map((c) => c.front) ?? [])];
                const cards = made.cards.filter((c) => !isRepeat(c.front, seen));
                if (!cards.length) return;
                if (!deck) {
                  const payload = { ...made, cards };
                  const { data: row, error } = await supabase
                    .from("actions")
                    .insert({ kind: "flashcards", payload, ...origin })
                    .select("id, message_id, document_id, space_id, kind, payload, state, created_at")
                    .single();
                  if (error) throw error;
                  deck = { id: row.id, payload };
                  send({ deck: toAction(row) });
                } else {
                  const sources = [...deck.payload.sources, ...made.sources.filter((s) => !deck!.payload.sources.some((d) => d.chunkId === s.chunkId))];
                  const payload = { ...deck.payload, cards: [...deck.payload.cards, ...cards], sources };
                  // Users can only change a deck's progress under RLS, so adding cards uses the secret key
                  const { error } = await admin.from("actions").update({ payload }).eq("id", deck.id).eq("user_id", userId);
                  if (error) throw error;
                  deck.payload = payload;
                  send({ added: cards.length, total: payload.cards.length });
                }
              });
              return saving;
            })
            .catch((error) => {
              if (!(error instanceof NothingToMakeError)) {
                console.error("Deck part failed:", error);
                failure ??= error;
              }
            })
        )
      );

      if (!deck) {
        send({
          // Nothing new to make isn't a failure; a deck made on its own after an upload stays quiet about it
          nothingNew: !failure,
          error:
            failure instanceof ModelsUnavailableError
              ? "The AI models are busy or out of free quota for today. Try again later."
              : failure
                ? "Something went wrong. Try again."
                : known.length
                  ? "Your reviewers already cover these notes. Add more notes to make another."
                  : "Couldn't find enough to make cards from.",
        });
      } else send({ done: true, total: (deck as { payload: FlashcardsPayload }).payload.cards.length });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
