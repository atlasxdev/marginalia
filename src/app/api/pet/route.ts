import { createClient } from "@/lib/supabase/server";
import type { Pet } from "@/lib/types";

// The signed-in user's pet, or null before they've made one (or before migration 0005)
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pets").select("name, species, color, eyes, accessory, x, y").maybeSingle();
  if (error || !data) return Response.json(null);
  return Response.json(data satisfies Pet as Pet);
}
