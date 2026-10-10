"use server";

import { z } from "zod";
import { questionSchema } from "@/lib/schemas";
import type { ActionState } from "@/lib/types";
import * as store from "@/server/mock-store";

// `question` is echoed back on errors so the composer can restore what was typed.
export type AskState = ActionState & { conversationId?: string; question?: string };

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

  const { question, conversationId } = parsed.data;
  if (!conversationId) {
    const conv = await store.createConversation(question);
    return { ok: true, conversationId: conv.id };
  }

  const message = await store.addUserMessage(conversationId, question);
  if (!message) return { ok: false, message: "This conversation was deleted.", question };
  return { ok: true, conversationId };
}

export async function deleteConversation(id: string): Promise<ActionState> {
  await store.deleteConversation(z.string().parse(id));
  return { ok: true };
}
