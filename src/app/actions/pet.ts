"use server";

import { z } from "zod";
import { ACCESSORIES, EYES, SPECIES } from "@/lib/pet-art";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

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
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Sign in again to save your pet." };
  const { error } = await supabase
    .from("pets")
    .upsert({ user_id: auth.user.id, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "Couldn't save your pet. Try again." };
  return { ok: true };
}

/** XP for using Marginalia: answered questions and uploads. */
export async function addPetXp(amount: number): Promise<ActionState> {
  const gain = z.number().int().min(1).max(20).safeParse(amount);
  if (!gain.success) return { ok: false };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const { data } = await supabase.from("pets").select("xp").eq("user_id", auth.user.id).maybeSingle();
  if (!data) return { ok: false };
  const { error } = await supabase.from("pets").update({ xp: data.xp + gain.data }).eq("user_id", auth.user.id);
  return { ok: !error };
}

export async function releasePet(): Promise<ActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Sign in again." };
  const { error } = await supabase.from("pets").delete().eq("user_id", auth.user.id);
  if (error) return { ok: false, message: "Couldn't do that. Try again." };
  return { ok: true };
}
