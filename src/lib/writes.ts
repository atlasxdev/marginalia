import { z } from "zod";
import { noteJsonPath } from "@/lib/note";
import { ACCESSORIES, EYES, SPECIES } from "@/lib/pet-art";
import { questionSchema, spaceSchema } from "@/lib/schemas";
import { getBrowserClient } from "@/lib/supabase/client";
import type { ActionState, AttemptResult, CardProgress } from "@/lib/types";

/* Writes go straight from the browser to Supabase, as the signed-in user, so
   row level security keeps each one to the user's own rows. Anything that
   needs the AI or the secret key stays on the server. */

const sb = () => getBrowserClient();
// The signed-in user, from the session the browser already holds
const userId = async () => (await sb().auth.getSession()).data.session?.user.id ?? null;

/* ---------- chats ---------- */

// `question` is echoed back on errors so the composer can restore what was typed.
export type AskState = ActionState & { conversationId?: string; question?: string };

const TITLE_CHARS = 80;

// Saves the question. The answer streams separately from /api/conversations/[id]/answer.
export async function askQuestion(_prev: AskState, formData: FormData): Promise<AskState> {
  const parsed = questionSchema.safeParse({
    question: formData.get("question"),
    conversationId: formData.get("conversationId") || undefined,
    spaceId: formData.get("spaceId") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors, question: String(formData.get("question") ?? "") };
  }

  const { question } = parsed.data;
  let { conversationId } = parsed.data;

  if (!conversationId) {
    const title = question.length > TITLE_CHARS ? question.slice(0, TITLE_CHARS - 1).trimEnd() + "…" : question;
    // RLS only accepts a space the user owns
    const { data, error } = await sb().from("conversations").insert({ title, space_id: parsed.data.spaceId ?? null }).select("id").single();
    if (error) return { ok: false, message: "Couldn't start a conversation. Try again.", question };
    conversationId = data.id as string;
  }

  // RLS rejects the insert if the conversation isn't this user's or no longer exists
  const { error } = await sb().from("messages").insert({ conversation_id: conversationId, role: "user", content: question });
  if (error) return { ok: false, message: "This conversation was deleted.", question };
  return { ok: true, conversationId };
}

const titleSchema = z.string().trim().min(1, "Give it a name.").max(200, "Keep it under 200 characters.");

export async function renameConversation(id: string, title: string): Promise<ActionState> {
  const parsed = titleSchema.safeParse(title);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { data, error } = await sb().from("conversations").update({ title: parsed.data }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, message: "Couldn't rename this conversation. Try again." };
  return { ok: true };
}

export async function pinConversation(id: string, pinned: boolean): Promise<ActionState> {
  const { data, error } = await sb().from("conversations").update({ pinned }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, message: `Couldn't ${pinned ? "pin" : "unpin"} this conversation. Try again.` };
  return { ok: true };
}

/** Saves the manual order: the first id goes first. */
export async function reorderConversations(ids: string[]): Promise<ActionState> {
  const { error } = await sb().rpc("reorder_conversations", { ids: ids.slice(0, 500) });
  if (error) return { ok: false, message: "Couldn't save the order. Try again." };
  return { ok: true };
}

export async function deleteConversation(id: string): Promise<ActionState> {
  const { data, error } = await sb().from("conversations").delete().eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, message: "Couldn't delete this conversation. Try again." };
  return { ok: true };
}

/* ---------- documents ---------- */

export async function deleteDocument(id: string): Promise<ActionState> {
  const { data, error } = await sb().from("documents").delete().eq("id", id).select("storage_path").maybeSingle();
  if (error || !data) return { ok: false, message: "Couldn't delete this document. Try again." };
  // Chunks go with the row (on delete cascade); the file, and a note's JSON, are removed from Storage
  await sb().storage.from("documents").remove([data.storage_path, noteJsonPath(data.storage_path)]);
  return { ok: true };
}

/* ---------- subjects ---------- */

export type SaveSpaceState = ActionState & { id?: string };

// Creates a subject, or updates one, with its name, instructions and documents in one save
export async function saveSpace(input: z.input<typeof spaceSchema>): Promise<SaveSpaceState> {
  const parsed = spaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { id, name, instructions, documentIds } = parsed.data;
  const supabase = sb();
  const fail = { ok: false, message: "Couldn't save this subject. Try again." } as const;

  let spaceId = id;
  if (spaceId) {
    const { data, error } = await supabase
      .from("spaces")
      .update({ name, instructions, updated_at: new Date().toISOString() })
      .eq("id", spaceId)
      .select("id");
    if (error || !data?.length) return fail;
  } else {
    // A new subject starts with your default answer style, if you've picked one
    const preferred = (await supabase.auth.getSession()).data.session?.user.user_metadata?.study_method;
    const study_method = ["recall", "feynman", "socratic", "answer"].includes(preferred) ? preferred : undefined;
    const { data, error } = await supabase.from("spaces").insert({ name, instructions, ...(study_method && { study_method }) }).select("id").single();
    if (error) return { ok: false, message: "Couldn't create this subject. Try again." };
    spaceId = data.id as string;
  }

  // Replace the subject's documents with exactly this set
  const { data: current, error: readError } = await supabase.from("space_documents").select("document_id").eq("space_id", spaceId);
  if (readError) return { ...fail, id: spaceId };

  const have = new Set((current as { document_id: string }[]).map((r) => r.document_id));
  const want = new Set(documentIds);
  const removed = [...have].filter((d) => !want.has(d));
  const added = [...want].filter((d) => !have.has(d));

  if (removed.length) {
    const { error } = await supabase.from("space_documents").delete().eq("space_id", spaceId).in("document_id", removed);
    if (error) return { ...fail, id: spaceId };
  }
  if (added.length) {
    const { error } = await supabase.from("space_documents").insert(added.map((document_id) => ({ space_id: spaceId, document_id })));
    if (error) return { ...fail, id: spaceId };
  }
  return { ok: true, id: spaceId };
}

export async function deleteSpace(id: string): Promise<ActionState> {
  const { error } = await sb().from("spaces").delete().eq("id", id);
  if (error) return { ok: false, message: "Couldn't delete this subject. Try again." };
  return { ok: true };
}

/* ---------- study settings ---------- */

const goalSchema = z.union([z.literal(0), z.literal(10), z.literal(20), z.literal(30), z.literal(50)]);

/** Sets how many cards a day you aim for (0 turns the goal off). */
export async function setDailyGoal(goal: number): Promise<ActionState> {
  const parsed = goalSchema.safeParse(goal);
  if (!parsed.success) return { ok: false, message: "Pick a daily goal." };
  const { error } = await sb().auth.updateUser({ data: { daily_goal: parsed.data } });
  if (error) return { ok: false, message: "Couldn't save your goal. Try again." };
  return { ok: true };
}

const methodSchema = z.object({ method: z.enum(["recall", "feynman", "socratic", "answer"]), spaceId: z.uuid().optional() });

// Sets how your buddy teaches: for one subject, or your default (used by new subjects)
export async function setStudyMethod(input: z.input<typeof methodSchema>): Promise<ActionState> {
  const parsed = methodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick a study method." };
  const { method, spaceId } = parsed.data;
  if (spaceId) {
    const { data, error } = await sb().from("spaces").update({ study_method: method }).eq("id", spaceId).select("id");
    if (error || !data?.length) return { ok: false, message: "Couldn't change the method. Try again." };
  } else {
    const { error } = await sb().auth.updateUser({ data: { study_method: method } });
    if (error) return { ok: false, message: "Couldn't change the method. Try again." };
  }
  return { ok: true };
}

/* ---------- decks and checklists ---------- */

// After an action is made, only the user's progress changes: ticked items, or where each flashcard is
const stateSchema = z.union([
  z.object({ done: z.array(z.number().int().min(0).max(100)).max(100) }).strict(),
  z.object({ cards: z.record(z.string().regex(/^\d{1,2}$/), z.object({ box: z.number().int().min(0).max(5), due: z.iso.datetime() })) }).strict(),
]);

export async function saveActionState(id: string, state: { done: number[] } | { cards: Record<string, CardProgress> }) {
  const parsed = stateSchema.parse(state);
  const { error, count } = await sb()
    .from("actions")
    .update({ state: "done" in parsed ? { done: [...new Set(parsed.done)] } : parsed }, { count: "exact" })
    .eq("id", id);
  if (error) throw new Error("Couldn't save your progress.");
  if (!count) throw new Error("Not found.");
}

export async function deleteAction(id: string) {
  const { error } = await sb().from("actions").delete().eq("id", id);
  if (error) throw new Error("Couldn't remove it.");
}

/* ---------- study progress ---------- */

/** How a card went. Flip cards are "cards"; every picked answer, like true or false, is "quiz". */
export type AttemptInput = { deckId: string; index: number; topic?: string; result: AttemptResult; mode: "cards" | "quiz" };

// Typed answers are saved on the server when they're checked
export async function saveAttempts(attempts: AttemptInput[]) {
  if (!attempts.length) return;
  const { error } = await sb()
    .from("attempts")
    .insert(attempts.map((a) => ({ action_id: a.deckId, card_index: a.index, topic: a.topic ?? "", result: a.result, mode: a.mode })));
  if (error) throw new Error("Couldn't save your progress.");
}

export type StudySessionInput = { method: "pomodoro" | "52-17" | "flow"; focusSeconds: number; startedAt: string; spaceId?: string };

/** A finished focus session, for the week's numbers and your streak. */
export async function saveStudySession({ method, focusSeconds, startedAt, spaceId }: StudySessionInput) {
  const { error } = await sb()
    .from("study_sessions")
    .insert({ method, focus_seconds: Math.min(Math.max(focusSeconds, 60), 14_400), started_at: startedAt, space_id: spaceId ?? null });
  if (error) throw new Error("Couldn't save the session.");
}

/* ---------- your pet ---------- */

const petSchema = z.object({
  name: z.string().trim().min(1, "Give your pet a name.").max(24, "Keep the name under 24 characters."),
  species: z.enum(SPECIES),
  color: z.string().regex(/^#[0-9a-f]{6}$/),
  eyes: z.enum(EYES),
  accessory: z.enum(ACCESSORIES),
});
export type PetInput = z.input<typeof petSchema>;

/** Creates your pet, or changes how it looks and what it's called. */
export async function savePet(input: PetInput): Promise<ActionState> {
  const parsed = petSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const user = await userId();
  if (!user) return { ok: false, message: "Sign in again to save your pet." };
  const { error } = await sb()
    .from("pets")
    .upsert({ user_id: user, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "Couldn't save your pet. Try again." };
  return { ok: true };
}

/** XP for using Marginalia: answered questions, finished sessions and uploads. */
export async function addPetXp(amount: number): Promise<ActionState> {
  const gain = z.number().int().min(1).max(20).safeParse(amount);
  if (!gain.success) return { ok: false };
  const user = await userId();
  if (!user) return { ok: false };
  const { data } = await sb().from("pets").select("xp").eq("user_id", user).maybeSingle();
  if (!data) return { ok: false };
  const { error } = await sb().from("pets").update({ xp: data.xp + gain.data }).eq("user_id", user);
  return { ok: !error };
}

export async function releasePet(): Promise<ActionState> {
  const user = await userId();
  if (!user) return { ok: false, message: "Sign in again." };
  const { error } = await sb().from("pets").delete().eq("user_id", user);
  if (error) return { ok: false, message: "Couldn't do that. Try again." };
  return { ok: true };
}
