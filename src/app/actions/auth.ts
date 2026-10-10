"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { signInSchema, signUpSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      message:
        error.code === "email_not_confirmed"
          ? "Confirm your email first. The link is in the email we sent you."
          : "Email or password is incorrect.",
    };
  }
  redirect("/chat");
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { name, email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name }, emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm` },
  });
  if (error) {
    return {
      ok: false,
      message:
        error.code === "weak_password"
          ? "Choose a stronger password."
          : error.code === "over_email_send_rate_limit"
            ? "Too many sign-ups right now. Try again in a few minutes."
            : "Couldn't create your account. Try again.",
    };
  }

  // With email confirmation on, there's no session until the link is opened
  if (!data.session) {
    return { ok: true, message: `Check ${email} for a link to confirm your account.` };
  }
  redirect("/chat");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
