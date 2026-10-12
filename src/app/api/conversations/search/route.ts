import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { searchConversations } from "@/server/data";

// Searches the signed-in user's conversation titles and messages
export async function GET(request: Request) {
  const q = z.string().trim().min(2).max(100).safeParse(new URL(request.url).searchParams.get("q"));
  if (!q.success) return Response.json([]);
  return Response.json(await searchConversations(await createClient(), q.data));
}
