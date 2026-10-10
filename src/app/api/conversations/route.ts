import { createClient } from "@/lib/supabase/server";
import { listConversations } from "@/server/data";

export async function GET() {
  return Response.json(await listConversations(await createClient()));
}
