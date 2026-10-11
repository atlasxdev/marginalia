"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { TextField } from "@/components/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, { ok: false });
  const errors = state.fieldErrors ?? {};

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-3 text-muted-foreground">We&apos;ll email you a link to choose a new one.</p>

      <form action={formAction} className="mt-10 grid gap-6 text-left" noValidate>
        <FieldGroup>
          <TextField label="Email" name="email" type="email" autoComplete="email" error={errors.email?.[0]} />
        </FieldGroup>
        <Button type="submit" disabled={pending} className="h-12 rounded-xl text-[17px]">
          {pending ? "Sending…" : "Send reset link"}
        </Button>
        {state.message && (
          <Alert variant={state.ok ? "default" : "destructive"} role={state.ok ? "status" : "alert"}>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
      </form>

      <p className="mt-8 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
