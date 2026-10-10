import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Acts as the signed-in user, so row level security applies to every query.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only. The proxy refreshes them.
          }
        },
      },
    }
  );
}

// The signed-in user's id, or null. getClaims verifies the JWT rather than trusting the cookie.
export async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}
