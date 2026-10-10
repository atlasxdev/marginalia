"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, { ok: false });

  return (
    <>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">Create an account</CardTitle>
        <CardDescription className="text-base">Your documents stay private to your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5" noValidate>
          <Field label="Name" name="name" autoComplete="name" errors={state.fieldErrors?.name} />
          <Field label="Email" name="email" type="email" autoComplete="email" errors={state.fieldErrors?.email} />
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
          <Button type="submit" size="lg" disabled={pending} className="h-10 text-[15px]">
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="bg-transparent text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link href="/sign-in" className="font-medium text-ring underline-offset-4 hover:underline">
          Sign in
        </Link>
      </CardFooter>
    </>
  );
}
