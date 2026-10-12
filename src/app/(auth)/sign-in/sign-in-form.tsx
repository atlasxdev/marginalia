"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { TextField } from "@/components/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function SignInForm({ linkFailed = false }: { linkFailed?: boolean }) {
  const [state, formAction, pending] = useActionState(signIn, { ok: false });
  const errors = state.fieldErrors ?? {};

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-muted-foreground">Ask questions about your documents.</p>

      {linkFailed && (
        <Alert variant="destructive" role="alert" className="mt-8 text-left">
          <AlertDescription>
            That link has expired or was already used.{" "}
            <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
              Get a new reset link
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <form action={formAction} className="mt-8 grid gap-6 text-left" noValidate>
        <FieldGroup>
          <TextField label="Email" name="email" type="email" autoComplete="email" error={errors.email?.[0]} />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.[0]}
          />
        </FieldGroup>
        <Link href="/forgot-password" className="-mt-2 justify-self-end text-sm text-primary hover:underline">
          Forgot password?
        </Link>
        <Button type="submit" disabled={pending} className="h-12 rounded-xl text-[17px]">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        {state.message && (
          <Alert variant={state.ok ? "default" : "destructive"} role={state.ok ? "status" : "alert"}>
            <AlertDescription className={state.ok ? "text-success" : undefined}>{state.message}</AlertDescription>
          </Alert>
        )}
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
