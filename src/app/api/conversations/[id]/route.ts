import { createClient } from "@/lib/supabase/server";
import { getConversation } from "@/server/data";

export async function GET(_req: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const { id } = await ctx.params;
  const conversation = await getConversation(await createClient(), id);
  if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });
  return Response.json(conversation);
}
