import { createClient } from "@/lib/supabase/server";
import { listDocuments } from "@/server/data";

export async function GET() {
  return Response.json(await listDocuments(await createClient()));
}
