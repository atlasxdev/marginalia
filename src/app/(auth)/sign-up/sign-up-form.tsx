"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, { ok: false });

  return (
    <div className="text-center">
      <h1 className="text-5xl leading-[0.95] font-semibold tracking-[-0.045em] text-balance sm:text-6xl">
        Ask your documents anything.
      </h1>
      <p className="mx-auto mt-4 max-w-xs text-muted-foreground">
        Every answer shows the exact passage it came from.
      </p>

      <form action={formAction} className="mx-auto mt-8 grid max-w-sm gap-3" noValidate>
        <Field label="Name" name="name" autoComplete="name" hideLabel errors={state.fieldErrors?.name} />
        <Field label="Email" name="email" type="email" autoComplete="email" hideLabel errors={state.fieldErrors?.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hideLabel
          errors={state.fieldErrors?.password}
        />
        <Field
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          hideLabel
          errors={state.fieldErrors?.confirmPassword}
        />
        <Button type="submit" size="lg" disabled={pending} className="mt-1 h-11 text-[15px]">
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4 hover:text-ring">
          Sign in
        </Link>
      </p>
    </div>
  );
}
