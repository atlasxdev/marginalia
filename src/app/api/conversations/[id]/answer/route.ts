import { admin } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Source } from "@/lib/types";
import { DEFAULT_STUDY_METHOD, isStudyMethod } from "@/lib/study-methods";
import { getConversation, getSpace } from "@/server/data";
import { ModelsUnavailableError, streamChat } from "@/server/gemini";
import {
  DAILY_QUESTION_LIMIT,
  NOT_FOUND_ANSWER,
  buildContents,
  retrieve,
  standaloneQuestion,
  systemPrompt,
  toSources,
} from "@/server/rag";

// Streams the answer to the conversation's latest unanswered question.
// Protocol: first line is JSON `{ "sources": [...] }`, the rest is the answer text.
export async function POST(_req: Request, ctx: RouteContext<"/api/conversations/[id]/answer">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const conversation = await getConversation(supabase, id);
  if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });

  const last = conversation.messages.at(-1);
  if (!last || last.role !== "user") {
    return Response.json({ error: "Nothing to answer." }, { status: 409 });
  }

  const { data: allowed } = await admin.rpc("consume_question", {
    p_user_id: userId,
    p_limit: DAILY_QUESTION_LIMIT,
  });
  if (!allowed) {
    return Response.json(
      { error: `You've asked ${DAILY_QUESTION_LIMIT} questions today, the daily limit. Try again tomorrow.` },
      { status: 429 }
    );
  }

  // A conversation in a space searches only its documents and follows its instructions
  const space = conversation.space ? await getSpace(supabase, conversation.space.id) : null;
  if (space && space.documentIds.length === 0) {
    return Response.json({ error: "This subject has no files yet. Add some on its page." }, { status: 409 });
  }

  // How to teach: the subject's method, or your default for chats outside a subject
  const { data: auth } = await supabase.auth.getClaims();
  const preferred = auth?.claims.user_metadata?.study_method;
  const method = space?.studyMethod ?? (isStudyMethod(preferred) ? preferred : DEFAULT_STUDY_METHOD);

  const history = conversation.messages.slice(0, -1);
  let sources: Source[];
  let contents;
  try {
    const query = await standaloneQuestion(last.content, history);
    const rows = await retrieve(supabase, query, space?.documentIds);
    sources = toSources(rows);
    contents = rows.length ? buildContents(last.content, history, rows, method) : null;
  } catch (error) {
    console.error("Retrieval failed:", error);
    return Response.json({ error: "Couldn't search your notes. Try again." }, { status: 502 });
  }

  const save = (content: string) =>
    supabase.from("messages").insert({
      conversation_id: id,
      role: "assistant",
      content,
      sources: content === NOT_FOUND_ANSWER ? [] : sources,
    });

  const encoder = new TextEncoder();
  const header = encoder.encode(JSON.stringify({ sources }) + "\n");

  // Nothing relevant: answer without calling the model
  if (!contents) {
    await save(NOT_FOUND_ANSWER);
    return new Response(new Blob([header, NOT_FOUND_ANSWER]).stream(), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  let modelStream;
  try {
    modelStream = await streamChat(systemPrompt(space?.instructions, method), contents);
  } catch (error) {
    console.error("Generation failed:", error);
    const message =
      error instanceof ModelsUnavailableError
        ? "The AI models are busy or out of free quota for today. Try again later."
        : "Something went wrong while answering. Try again.";
    return Response.json({ error: message }, { status: 503 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(header);
      let text = "";
      try {
        for await (const chunk of modelStream) {
          const piece = chunk.text ?? "";
          text += piece;
          controller.enqueue(encoder.encode(piece));
        }
      } catch (error) {
        console.error("Stream interrupted:", error);
        const note = "\n\n_The answer was cut off. Ask again to get the rest._";
        text += note;
        controller.enqueue(encoder.encode(note));
      }
      await save(text.trim() || NOT_FOUND_ANSWER);
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
