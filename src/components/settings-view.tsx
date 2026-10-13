"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { HourglassIcon, InfinityIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon, TimerIcon } from "lucide-react";
import { changePassword, signOut, updateProfile } from "@/app/actions/auth";
import { setDailyGoal } from "@/app/actions/study";
import { DAILY_GOALS, useDailyGoal } from "@/lib/daily-goal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { petLevel } from "@/lib/pet-care";
import { meQuery, petQuery } from "@/lib/queries";
import { readTimer, saveTimer } from "@/lib/timer-pref";
import type { ActionState, FocusMethod } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { MethodPicker } from "./method-picker";
import { MusicLibrary } from "./music/music-library";
import { PetBuilder } from "./pet/pet-builder";
import { PetSprite } from "./pet/pet-sprite";

const inputClass = "h-11 rounded-xl px-3.5 text-[15px] md:text-[15px]";
const cardClass = "glass gap-0 rounded-2xl border border-glass-border bg-glass py-0";
const choiceClass =
  "glass h-auto flex-col gap-1.5 rounded-xl border border-glass-border bg-glass px-2 py-3 data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary";

export function SettingsView() {
  const hydrated = useHydrated();
  const me = useQuery(meQuery);
  const user = hydrated ? me.data : undefined;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 pt-14 pb-24 sm:px-8 lg:px-12">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

        <div className="mt-10 grid gap-12">
          {user ? (
            <>
              <Section title="Profile" description="How you appear in Marginalia.">
                <ProfileCard key={user.id} name={(user.user_metadata?.name as string | undefined) ?? ""} email={user.email ?? ""} />
              </Section>
              <Section title="Study buddy" description="It studies with you and grows as you learn.">
                <BuddyCard />
              </Section>
              <Section title="Studying" description="Defaults for sessions and new subjects.">
                <StudyingCard />
              </Section>
              <Section id="music" title="Music" description="Your own sounds to study to. They keep playing as you move around.">
                <Card className={cardClass}>
                  <CardContent className="p-6">
                    <MusicLibrary />
                  </CardContent>
                </Card>
              </Section>
              <Section title="Appearance" description="Light, dark, or match your device.">
                <AppearanceCard />
              </Section>
              <Section title="Account" description="Your password and sign-in.">
                <PasswordCard />
                <Card className={`${cardClass} mt-4`}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                    <div>
                      <p className="font-medium">Sign out</p>
                      <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
                    </div>
                    <Button variant="outline" onClick={() => signOut()}>
                      <LogOutIcon />
                      Sign out
                    </Button>
                  </CardContent>
                </Card>
              </Section>
            </>
          ) : (
            <>
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** A settings section: its title on the left on wide screens, above on narrow ones. */
function Section({ id, title, description, children }: { id?: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-label={title} className="grid scroll-mt-10 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <div className="px-1 lg:pt-5">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Your buddy, with a way to change how it looks or what it's called. */
function BuddyCard() {
  const pet = useQuery(petQuery).data;
  const [editing, setEditing] = useState(false);
  const level = pet ? petLevel(pet.xp) : null;
  return (
    <Card className={cardClass}>
      <CardContent className="flex flex-wrap items-center gap-5 p-6">
        <span className="grid h-20 w-24 shrink-0 place-items-end justify-center overflow-hidden rounded-2xl bg-[#e7effc] pb-2.5 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
          {pet ? <PetSprite look={pet} className="h-12 w-[45px]" /> : null}
        </span>
        <div className="min-w-40 flex-1">
          <p className="text-lg font-semibold">{pet?.name ?? "No buddy yet"}</p>
          {pet && level ? (
            <>
              <p className="text-sm text-muted-foreground">
                Level {level.level}, {pet.xp} XP. It levels up as you study.
              </p>
              <div className="mt-2 h-1.5 max-w-56 overflow-hidden rounded-full bg-foreground/10" aria-label={`${Math.round(level.progress * 100)}% to level ${level.level + 1}`}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, level.progress * 100)}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Hatch one to study with you.</p>
          )}
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          {pet ? "Customize" : "Hatch a buddy"}
        </Button>
      </CardContent>
      <PetBuilder open={editing} onOpenChange={setEditing} pet={pet ?? null} />
    </Card>
  );
}

const TIMERS: { value: FocusMethod; label: string; detail: string; icon: typeof TimerIcon }[] = [
  { value: "pomodoro", label: "Pomodoro", detail: "25 min, 5 break", icon: TimerIcon },
  { value: "52-17", label: "Long focus", detail: "52 min, 17 break", icon: HourglassIcon },
  { value: "flow", label: "No timer", detail: "Your own pace", icon: InfinityIcon },
];

/** Defaults for studying: the session timer, and how new subjects answer. */
function StudyingCard() {
  const [timer, setTimer] = useState<FocusMethod>(readTimer);
  const queryClient = useQueryClient();
  const { goal } = useDailyGoal();
  const changeGoal = async (next: number) => {
    // Show it at once; the save follows
    queryClient.setQueryData(["me"], (me: unknown) =>
      me && typeof me === "object" ? { ...me, user_metadata: { ...(me as { user_metadata?: object }).user_metadata, daily_goal: next } } : me
    );
    const result = await setDailyGoal(next);
    if (!result.ok) void queryClient.invalidateQueries({ queryKey: ["me"] });
  };
  return (
    <Card className={cardClass}>
      <CardContent className="grid gap-6 p-6">
        <div className="grid gap-3">
          <div>
            <p className="font-medium">Daily goal</p>
            <p className="text-sm text-muted-foreground">Cards to study each day. Today shows how close you are.</p>
          </div>
          <ToggleGroup
            type="single"
            value={String(goal)}
            onValueChange={(v) => v && void changeGoal(Number(v))}
            className="grid w-full grid-cols-5 gap-2"
            spacing={2}
          >
            {DAILY_GOALS.map((n) => (
              <ToggleGroupItem key={n} value={String(n)} className={choiceClass}>
                <span className="text-sm font-semibold">{n === 0 ? "Off" : n}</span>
                <span className="text-xs font-normal text-muted-foreground">{n === 0 ? "No goal" : "cards"}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="border-t border-glass-divider" />
        <div className="grid gap-3">
          <div>
            <p className="font-medium">Session timer</p>
            <p className="text-sm text-muted-foreground">What study sessions start with. You can still change it before each one.</p>
          </div>
          <ToggleGroup
            type="single"
            value={timer}
            onValueChange={(v) => {
              if (!v) return;
              setTimer(v as FocusMethod);
              saveTimer(v as FocusMethod);
            }}
            className="grid w-full grid-cols-3 gap-2"
            spacing={2}
          >
            {TIMERS.map(({ value, label, detail, icon: Icon }) => (
              <ToggleGroupItem key={value} value={value} className={choiceClass}>
                <Icon className="size-5" />
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs font-normal text-muted-foreground">{detail}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-glass-divider pt-6">
          <div className="min-w-48 flex-1">
            <p className="font-medium">Answer style for new subjects</p>
            <p className="text-sm text-muted-foreground">How your buddy answers questions. Each subject can change its own in its Ask tab.</p>
          </div>
          <MethodPicker />
        </div>
      </CardContent>
    </Card>
  );
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light", label: "Light", icon: SunIcon },
    { value: "dark", label: "Dark", icon: MoonIcon },
    { value: "system", label: "System", icon: MonitorIcon },
  ];
  return (
    <Card className={cardClass}>
      <CardContent className="p-6">
        <ToggleGroup type="single" value={theme ?? "system"} onValueChange={(v) => v && setTheme(v)} className="grid w-full grid-cols-3 gap-2" spacing={2}>
          {options.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem key={value} value={value} className={choiceClass}>
              <Icon className="size-5" />
              <span className="text-sm font-semibold">{label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardContent>
    </Card>
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
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground" aria-hidden>
            {(name || email || "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
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
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-4 border-t border-glass-divider px-6 py-4">
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
        <CardHeader className="px-6 pt-6">
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-5">
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
        <CardFooter className="justify-end gap-4 border-t border-glass-divider px-6 py-4">
          <Status state={state} />
          <Button type="submit" disabled={pending}>
            {pending ? "Changing…" : "Change password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
