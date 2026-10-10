import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Secret key: bypasses row level security. Only for ingestion and the quota,
// and always scoped to a user id checked beforehand.
export const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
