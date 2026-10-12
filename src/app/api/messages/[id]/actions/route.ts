import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Source } from "@/lib/types";
import { BUILT_KINDS, NothingToMakeError, buildAction, type Excerpt } from "@/server/actions";
import { toAction } from "@/server/data";
import { ModelsUnavailableError } from "@/server/gemini";
import { DAILY_QUESTION_LIMIT } from "@/server/rag";

const bodySchema = z.object({ kind: z.enum(BUILT_KINDS) });

// Makes something from an answer, like a checklist, and saves it under the answer.
export async function POST(req: Request, ctx: RouteContext<"/api/messages/[id]/actions">) {
  const { id } = await ctx.params;
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Unknown action." }, { status: 400 });

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const { data: message } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, sources, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!message || message.role !== "assistant") {
    return Response.json({ error: "Answer not found." }, { status: 404 });
  }
  const sources = message.sources as Source[];
  if (sources.length === 0) {
    return Response.json({ error: "This answer has no sources to work from." }, { status: 409 });
  }

  const { data: allowed } = await admin.rpc("consume_question", { p_user_id: userId, p_limit: DAILY_QUESTION_LIMIT });
  if (!allowed) {
    return Response.json(
      { error: `You've used your ${DAILY_QUESTION_LIMIT} questions for today. Try again tomorrow.` },
      { status: 429 }
    );
  }

  // The full passages (sources only keep an excerpt) and the question that was asked
  const [{ data: chunks }, { data: question }] = await Promise.all([
    supabase.from("chunks").select("id, content").in("id", sources.map((s) => Number(s.chunkId))),
    supabase
      .from("messages")
      .select("content")
      .eq("conversation_id", message.conversation_id)
      .eq("role", "user")
      .lt("created_at", message.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const contentById = new Map((chunks ?? []).map((c) => [String(c.id), c.content as string]));
  const excerpts: Excerpt[] = sources.map((source, i) => ({
    n: i + 1,
    source,
    content: contentById.get(source.chunkId) ?? source.excerpt,
  }));

  let payload;
  try {
    payload = await buildAction(body.data.kind, { question: question?.content ?? "", answer: message.content, excerpts });
  } catch (error) {
    if (error instanceof NothingToMakeError) {
      return Response.json({ error: "Couldn't find anything in the sources to make that from." }, { status: 422 });
    }
    console.error("Action failed:", error);
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

  const { data: row, error } = await supabase
    .from("actions")
    .insert({ message_id: id, kind: body.data.kind, payload })
    .select("id, message_id, kind, payload, state, created_at")
    .single();
  if (error) {
    console.error("Saving action failed:", error);
    return Response.json({ error: "Couldn't save it. Try again." }, { status: 500 });
  }
  return Response.json(toAction(row));
}
