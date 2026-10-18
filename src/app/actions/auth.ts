"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  profileSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      message:
        error.code === "email_not_confirmed"
          ? "Confirm your email first. The link is in the email we sent you."
          : "Email or password is incorrect.",
    };
  }
  redirect(data.user.user_metadata?.onboarded === true ? "/study" : "/welcome");
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
  // A new account starts with the welcome
  redirect("/welcome");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

// Sends a reset link. The reply is the same whether or not the account exists.
export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
  });
  if (error?.code === "over_email_send_rate_limit") {
    return { ok: false, message: "Too many requests right now. Try again in a few minutes." };
  }
  return { ok: true, message: `If there's an account for ${parsed.data.email}, a link to reset its password is on its way.` };
}

// Sets a new password after following the reset link, which signed the user in
export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: passwordError(error.code) };
  redirect("/study");
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { name: parsed.data.name } });
  if (error) return { ok: false, message: "Couldn't save your name. Try again." };
  return { ok: true, message: "Saved." };
}

// Checks the current password before setting a new one
export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return { ok: false, message: "Sign in again to change your password." };

  const { error: wrong } = await supabase.auth.signInWithPassword({
    email: data.user.email,
    password: parsed.data.currentPassword,
  });
  if (wrong) return { ok: false, fieldErrors: { currentPassword: ["That isn't your current password."] } };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: passwordError(error.code) };
  return { ok: true, message: "Password changed." };
}

function passwordError(code: string | undefined) {
  if (code === "same_password") return "Choose a password that's different from your current one.";
  if (code === "weak_password") return "Choose a stronger password.";
  if (code === "reauthentication_needed") return "Sign in again, then change your password.";
  return "Couldn't change your password. Try again.";
}
