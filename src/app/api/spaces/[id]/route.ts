import { createClient } from "@/lib/supabase/server";
import { getSpace } from "@/server/data";

export async function GET(_req: Request, ctx: RouteContext<"/api/spaces/[id]">) {
  const { id } = await ctx.params;
  const space = await getSpace(await createClient(), id);
  if (!space) return Response.json({ error: "Space not found." }, { status: 404 });
  return Response.json(space);
}
