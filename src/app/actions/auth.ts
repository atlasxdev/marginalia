"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signInSchema, signUpSchema } from "@/lib/schemas";
import type { ActionState } from "@/lib/types";

// Mock auth: validates input, then lets anyone in. Supabase Auth replaces the bodies.

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  await new Promise((r) => setTimeout(r, 500));
  redirect("/chat");
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  await new Promise((r) => setTimeout(r, 600));
  redirect("/chat");
}

export async function signOut() {
  redirect("/sign-in");
}
