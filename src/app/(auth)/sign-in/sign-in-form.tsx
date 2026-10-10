"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, { ok: false });

  return (
    <>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">Sign in</CardTitle>
        <CardDescription className="text-base">
          Pick up where you left off with your documents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5" noValidate>
          <Field label="Email" name="email" type="email" autoComplete="email" errors={state.fieldErrors?.email} />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            errors={state.fieldErrors?.password}
          />
          <Button type="submit" size="lg" disabled={pending} className="h-10 text-[15px]">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="bg-transparent text-sm text-muted-foreground">
        New here?&nbsp;
        <Link href="/sign-up" className="font-medium text-ring underline-offset-4 hover:underline">
          Create an account
        </Link>
      </CardFooter>
    </>
  );
}
