import { createClient } from "@/lib/supabase/server";
import type { Pet } from "@/lib/types";

type Row = { name: string; species: Pet["species"]; color: string; eyes: Pet["eyes"]; accessory: Pet["accessory"]; xp?: number };

// The signed-in user's pet, or null before they've made one
export async function GET() {
  const supabase = await createClient();
  let { data, error } = await supabase.from("pets").select("name, species, color, eyes, accessory, xp").maybeSingle();
  // Before migration 0006 there's no xp column yet
  if (error?.code === "42703") ({ data, error } = await supabase.from("pets").select("name, species, color, eyes, accessory").maybeSingle());
  if (error || !data) return Response.json(null);
  const row = data as Row;
  const pet: Pet = { name: row.name, species: row.species, color: row.color, eyes: row.eyes, accessory: row.accessory, xp: row.xp ?? 0 };
  return Response.json(pet);
}
