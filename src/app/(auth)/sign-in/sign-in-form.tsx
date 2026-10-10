"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, { ok: false });

  return (
    <div className="text-center">
      <h1 className="text-5xl leading-[0.95] font-semibold tracking-[-0.045em] text-balance sm:text-6xl">
        Welcome back.
      </h1>
      <p className="mx-auto mt-4 max-w-xs text-muted-foreground">
        Sign in to pick up where you left off with your documents.
      </p>

      <form action={formAction} className="mx-auto mt-8 grid max-w-sm gap-3" noValidate>
        <Field label="Email" name="email" type="email" autoComplete="email" hideLabel errors={state.fieldErrors?.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          hideLabel
          errors={state.fieldErrors?.password}
        />
        <Button type="submit" size="lg" disabled={pending} className="mt-1 h-11 text-[15px]">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-foreground underline underline-offset-4 hover:text-ring">
          Create an account
        </Link>
      </p>
    </div>
  );
}
