"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { FieldGroup, GroupedInput } from "@/components/field";
import { Button } from "@/components/ui/button";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, { ok: false });
  const errors = state.fieldErrors ?? {};

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Sign in to Marginalia</h1>
      <p className="mt-2 text-muted-foreground">Ask questions about your documents.</p>

      <form action={formAction} className="mt-8 grid gap-4" noValidate>
        <FieldGroup>
          <GroupedInput label="Email" name="email" type="email" autoComplete="email" error={errors.email?.[0]} />
          <GroupedInput
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.[0]}
          />
        </FieldGroup>
        <Button type="submit" disabled={pending} className="h-12 rounded-xl text-[17px]">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="text-primary hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
