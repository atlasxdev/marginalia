"use client";

import { useActionState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { changePassword, updateProfile } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { meQuery } from "@/lib/queries";
import { MethodPicker } from "./method-picker";
import type { ActionState } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";

const inputClass = "h-11 rounded-xl px-3.5 text-[15px] md:text-[15px]";
const cardClass = "glass gap-0 rounded-2xl border border-glass-border bg-glass py-0";

export function SettingsView() {
  const hydrated = useHydrated();
  const me = useQuery(meQuery);
  const user = hydrated ? me.data : undefined;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-5 pt-14 pb-24 sm:px-8 lg:px-12">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">Your name, how your buddy teaches, and your password.</p>

        <div className="mt-10 grid gap-8">
          {user ? (
            <>
              <ProfileCard key={user.id} name={(user.user_metadata?.name as string | undefined) ?? ""} email={user.email ?? ""} />
              <Card className={cardClass}>
                <CardHeader className="p-6 pb-0">
                  <CardTitle className="text-lg">Studying</CardTitle>
                  <CardDescription>
                    How your buddy teaches in chats outside a subject. Each subject can have its own, set on its page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <MethodPicker />
                </CardContent>
              </Card>
              <PasswordCard />
            </>
          ) : (
            <>
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-80 rounded-2xl" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Status({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
      {state.message}
    </p>
  );
}

function ProfileCard({ name, email }: { name: string; email: string }) {
  const queryClient = useQueryClient();
  const [state, formAction, pending] = useActionState(updateProfile, { ok: false });
  const errors = state.fieldErrors ?? {};

  // The sidebar shows the name, so refresh it after a save
  useEffect(() => {
    if (state.ok) queryClient.invalidateQueries({ queryKey: ["me"] });
  }, [state, queryClient]);

  return (
    <Card className={cardClass}>
      <form action={formAction}>
        <CardHeader className="px-7 pt-7">
          <CardTitle className="text-lg">Profile</CardTitle>
          <CardDescription>How you appear in Marginalia.</CardDescription>
        </CardHeader>
        <CardContent className="px-7 py-6">
          <FieldGroup>
            <Field data-invalid={!!errors.name || undefined}>
              <FieldLabel htmlFor="settings-name">Name</FieldLabel>
              <Input
                id="settings-name"
                name="name"
                defaultValue={name}
                autoComplete="name"
                maxLength={80}
                aria-invalid={!!errors.name || undefined}
                className={inputClass}
              />
              {errors.name && <FieldError>{errors.name[0]}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="settings-email">Email</FieldLabel>
              <Input id="settings-email" value={email} readOnly disabled className={inputClass} />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-4 border-t border-glass-divider px-7 py-5">
          <Status state={state} />
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [state, formAction, pending] = useActionState(changePassword, { ok: false });
  const errors = state.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields once the password has changed
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const fields = [
    { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
    { name: "password", label: "New password", autoComplete: "new-password" },
    { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
  ];

  return (
    <Card className={cardClass}>
      <form ref={formRef} action={formAction} noValidate>
        <CardHeader className="px-7 pt-7">
          <CardTitle className="text-lg">Password</CardTitle>
          <CardDescription>Use at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent className="px-7 py-6">
          <FieldGroup>
            {fields.map((f) => {
              const error = errors[f.name]?.[0];
              return (
                <Field key={f.name} data-invalid={!!error || undefined}>
                  <FieldLabel htmlFor={`settings-${f.name}`}>{f.label}</FieldLabel>
                  <Input
                    id={`settings-${f.name}`}
                    name={f.name}
                    type="password"
                    autoComplete={f.autoComplete}
                    aria-invalid={!!error || undefined}
                    className={inputClass}
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
              );
            })}
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-4 border-t border-glass-divider px-7 py-5">
          <Status state={state} />
          <Button type="submit" disabled={pending}>
            {pending ? "Changing…" : "Change password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
