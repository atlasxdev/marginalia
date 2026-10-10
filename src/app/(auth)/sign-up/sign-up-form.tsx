"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { Field, SubmitButton } from "@/components/field";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, { ok: false });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-2 text-ink-soft">Your documents stay private to your account.</p>

      <form action={formAction} className="mt-8 space-y-5" noValidate>
        <Field label="Name" name="name" autoComplete="name" errors={state.fieldErrors?.name} />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          errors={state.fieldErrors?.email}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          errors={state.fieldErrors?.password}
        />
        <Field
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          errors={state.fieldErrors?.confirmPassword}
        />
        <SubmitButton pending={pending}>
          {pending ? "Creating account…" : "Create account"}
        </SubmitButton>
      </form>

      <p className="mt-8 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-pen underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
