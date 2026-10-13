"use server";

import { z } from "zod";
import { spaceSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

// Every write runs as the user, so row level security keeps it to their own spaces and documents.

export type SaveSpaceState = ActionState & { id?: string };

// Creates a space, or updates one, with its name, instructions and documents in one save
export async function saveSpace(input: z.input<typeof spaceSchema>): Promise<SaveSpaceState> {
  const parsed = spaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { id, name, instructions, documentIds } = parsed.data;
  const supabase = await createClient();
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
    const { data: auth } = await supabase.auth.getUser();
    const preferred = auth.user?.user_metadata?.study_method;
    const study_method = ["recall", "feynman", "socratic", "answer"].includes(preferred) ? preferred : undefined;
    const { data, error } = await supabase.from("spaces").insert({ name, instructions, ...(study_method && { study_method }) }).select("id").single();
    if (error) return { ok: false, message: "Couldn't create this subject. Try again." };
    spaceId = data.id as string;
  }

  // Replace the space's documents with exactly this set
  const { data: current, error: readError } = await supabase
    .from("space_documents")
    .select("document_id")
    .eq("space_id", spaceId);
  if (readError) return { ...fail, id: spaceId };

  const have = new Set(current.map((r) => r.document_id as string));
  const want = new Set(documentIds);
  const removed = [...have].filter((d) => !want.has(d));
  const added = [...want].filter((d) => !have.has(d));

  if (removed.length) {
    const { error } = await supabase.from("space_documents").delete().eq("space_id", spaceId).in("document_id", removed);
    if (error) return { ...fail, id: spaceId };
  }
  if (added.length) {
    const { error } = await supabase
      .from("space_documents")
      .insert(added.map((document_id) => ({ space_id: spaceId, document_id })));
    if (error) return { ...fail, id: spaceId };
  }
  return { ok: true, id: spaceId };
}

export async function deleteSpace(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("spaces").delete().eq("id", z.uuid().parse(id));
  if (error) return { ok: false, message: "Couldn't delete this subject. Try again." };
  return { ok: true };
}
