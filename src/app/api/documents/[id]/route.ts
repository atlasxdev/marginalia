import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEditableDocument } from "@/server/data";

export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const doc = z.uuid().safeParse(id).success ? await getEditableDocument(await createClient(), id) : null;
  if (!doc) return Response.json({ error: "Document not found." }, { status: 404 });
  return Response.json(doc);
}
