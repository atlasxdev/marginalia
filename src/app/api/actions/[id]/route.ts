import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// After an action is made, only the user's progress changes: which items are ticked
const stateSchema = z.object({ done: z.array(z.number().int().min(0).max(100)).max(100) });

export async function PATCH(req: Request, ctx: RouteContext<"/api/actions/[id]">) {
  const { id } = await ctx.params;
  const state = stateSchema.safeParse(await req.json().catch(() => null));
  if (!state.success) return Response.json({ error: "Invalid progress." }, { status: 400 });

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("actions")
    .update({ state: { done: [...new Set(state.data.done)] } }, { count: "exact" })
    .eq("id", id);
  if (error) return Response.json({ error: "Couldn't save your progress." }, { status: 500 });
  if (!count) return Response.json({ error: "Not found." }, { status: 404 });
  return new Response(null, { status: 204 });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/actions/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { error } = await supabase.from("actions").delete().eq("id", id);
  if (error) return Response.json({ error: "Couldn't remove it." }, { status: 500 });
  return new Response(null, { status: 204 });
}
