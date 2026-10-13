import { createClient, getUserId } from "@/lib/supabase/server";
import { getStudyOverview } from "@/server/study";

// Your decks, weak topics and this week's numbers, for the Study page
export async function GET() {
  const supabase = await createClient();
  if (!(await getUserId(supabase))) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  return Response.json(await getStudyOverview(supabase));
}
