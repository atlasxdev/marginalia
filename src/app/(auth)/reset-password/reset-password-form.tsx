"use client";

import { useActionState } from "react";
import { resetPassword } from "@/app/actions/auth";
import { TextField } from "@/components/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPassword, { ok: false });
  const errors = state.fieldErrors ?? {};

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-3 text-muted-foreground">Use at least 8 characters.</p>

      <form action={formAction} className="mt-10 grid gap-6 text-left" noValidate>
        <FieldGroup>
          <TextField label="New password" name="password" type="password" autoComplete="new-password" error={errors.password?.[0]} />
          <TextField
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.[0]}
          />
        </FieldGroup>
        <Button type="submit" disabled={pending} className="h-12 rounded-xl text-[17px]">
          {pending ? "Saving…" : "Save password"}
        </Button>
        {state.message && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
      </form>
    </>
  );
}
