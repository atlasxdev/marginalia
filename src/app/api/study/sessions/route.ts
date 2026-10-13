import { z } from "zod";
import { createClient, getUserId } from "@/lib/supabase/server";

const bodySchema = z.object({
  method: z.enum(["pomodoro", "52-17", "flow"]),
  focusSeconds: z.number().int().min(60).max(14_400),
  startedAt: z.iso.datetime(),
  spaceId: z.uuid().optional(),
});

// Saves a finished focus session, for the week's numbers and your streak
export async function POST(req: Request) {
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid session." }, { status: 400 });

  const supabase = await createClient();
  if (!(await getUserId(supabase))) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const { method, focusSeconds, startedAt, spaceId } = body.data;
  const { error } = await supabase
    .from("study_sessions")
    .insert({ method, focus_seconds: focusSeconds, started_at: startedAt, space_id: spaceId ?? null });
  if (error) return Response.json({ error: "Couldn't save the session." }, { status: 500 });
  return new Response(null, { status: 204 });
}
