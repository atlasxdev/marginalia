import { createClient } from "@/lib/supabase/server";
import { listSpaces } from "@/server/data";

export async function GET() {
  return Response.json(await listSpaces(await createClient()));
}
