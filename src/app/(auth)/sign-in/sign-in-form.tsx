"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { Field, SubmitButton } from "@/components/field";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, { ok: false });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-ink-soft">Pick up where you left off with your documents.</p>

      <form action={formAction} className="mt-8 space-y-5" noValidate>
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
          autoComplete="current-password"
          errors={state.fieldErrors?.password}
        />
        <SubmitButton pending={pending}>{pending ? "Signing in…" : "Sign in"}</SubmitButton>
      </form>

      <p className="mt-8 text-sm text-ink-soft">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-pen underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
