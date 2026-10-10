"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { FieldGroup, GroupedInput } from "@/components/field";
import { Button } from "@/components/ui/button";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, { ok: false });
  const errors = state.fieldErrors ?? {};

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-2 text-muted-foreground">Your documents stay private to you.</p>

      <form action={formAction} className="mt-8 grid gap-4" noValidate>
        <FieldGroup>
          <GroupedInput label="Name" name="name" autoComplete="name" error={errors.name?.[0]} />
          <GroupedInput label="Email" name="email" type="email" autoComplete="email" error={errors.email?.[0]} />
          <GroupedInput
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.[0]}
          />
          <GroupedInput
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.[0]}
          />
        </FieldGroup>
        <Button type="submit" disabled={pending} className="h-12 rounded-xl text-[17px]">
          {pending ? "Creating account…" : "Create account"}
        </Button>
        {state.message && (
          <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-success" : "text-sm text-destructive"}>
            {state.message}
          </p>
        )}
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
