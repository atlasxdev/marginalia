"use server";

import { z } from "zod";
import { questionSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

// `question` is echoed back on errors so the composer can restore what was typed.
export type AskState = ActionState & { conversationId?: string; question?: string };

const TITLE_CHARS = 80;

// Saves the question. The answer streams separately from /api/conversations/[id]/answer.
export async function askQuestion(_prev: AskState, formData: FormData): Promise<AskState> {
  const parsed = questionSchema.safeParse({
    question: formData.get("question"),
    conversationId: formData.get("conversationId") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      question: String(formData.get("question") ?? ""),
    };
  }

  const { question } = parsed.data;
  let { conversationId } = parsed.data;
  const supabase = await createClient();

  if (!conversationId) {
    const title =
      question.length > TITLE_CHARS ? question.slice(0, TITLE_CHARS - 1).trimEnd() + "…" : question;
    const { data, error } = await supabase.from("conversations").insert({ title }).select("id").single();
    if (error) return { ok: false, message: "Couldn't start a conversation. Try again.", question };
    conversationId = data.id as string;
  }

  // RLS rejects the insert if the conversation isn't this user's or no longer exists
  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role: "user", content: question });
  if (error) return { ok: false, message: "This conversation was deleted.", question };

  return { ok: true, conversationId };
}

export async function deleteConversation(id: string): Promise<ActionState> {
  const supabase = await createClient();
  await supabase.from("conversations").delete().eq("id", z.uuid().parse(id));
  return { ok: true };
}
