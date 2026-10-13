import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Links in the confirmation and password reset emails land here, with either a PKCE code or a token hash.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Missing code") };

  // Only follow paths inside this site, like /reset-password from the reset email
  const next = params.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
  const target = error ? "/sign-in?error=link" : (safeNext ?? (type === "recovery" ? "/reset-password" : "/study"));
  return NextResponse.redirect(new URL(target, request.url));
}
