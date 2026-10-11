"use server";

import { z } from "zod";
import { spaceSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

// Every write runs as the user, so row level security keeps it to their own spaces and documents.

export type CreateSpaceState = ActionState & { id?: string };

export async function createSpace(): Promise<CreateSpaceState> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("spaces").insert({ name: "Untitled space" }).select("id").single();
  if (error) return { ok: false, message: "Couldn't create a space. Try again." };
  return { ok: true, id: data.id as string };
}

export async function updateSpace(input: z.input<typeof spaceSchema>): Promise<ActionState> {
  const parsed = spaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { id, name, instructions } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spaces")
    .update({ name, instructions, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Couldn't save this space. Try again." };
  return { ok: true };
}

const documentsSchema = z.object({
  spaceId: z.uuid(),
  documentIds: z.array(z.uuid()).max(500),
});

// Replaces the space's documents with exactly this set
export async function setSpaceDocuments(input: z.input<typeof documentsSchema>): Promise<ActionState> {
  const parsed = documentsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That selection didn't look right. Try again." };
  const { spaceId, documentIds } = parsed.data;
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("space_documents")
    .select("document_id")
    .eq("space_id", spaceId);
  if (readError) return { ok: false, message: "Couldn't update this space. Try again." };

  const have = new Set(current.map((r) => r.document_id as string));
  const want = new Set(documentIds);
  const removed = [...have].filter((id) => !want.has(id));
  const added = [...want].filter((id) => !have.has(id));

  if (removed.length) {
    const { error } = await supabase
      .from("space_documents")
      .delete()
      .eq("space_id", spaceId)
      .in("document_id", removed);
    if (error) return { ok: false, message: "Couldn't update this space. Try again." };
  }
  if (added.length) {
    const { error } = await supabase
      .from("space_documents")
      .insert(added.map((document_id) => ({ space_id: spaceId, document_id })));
    if (error) return { ok: false, message: "Couldn't update this space. Try again." };
  }
  await supabase.from("spaces").update({ updated_at: new Date().toISOString() }).eq("id", spaceId);
  return { ok: true };
}

export async function deleteSpace(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("spaces").delete().eq("id", z.uuid().parse(id));
  if (error) return { ok: false, message: "Couldn't delete this space. Try again." };
  return { ok: true };
}
