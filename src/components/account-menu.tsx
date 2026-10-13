"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { ChevronsUpDownIcon, LogOutIcon, MonitorIcon, MoonIcon, PaletteIcon, SettingsIcon, SunIcon } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { petLevel, streakFrom } from "@/lib/pet-care";
import { openPet } from "@/lib/pet-events";
import { meQuery, petQuery, studyQuery } from "@/lib/queries";
import { PetSprite } from "./pet/pet-sprite";

/** Your account in the sidebar: who you are, your week, your buddy, and settings. */
export function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
  const me = useQuery(meQuery).data;
  const pet = useQuery(petQuery).data;
  const overview = useQuery(studyQuery).data;
  const { theme, setTheme } = useTheme();
  const name = me?.user_metadata?.name as string | undefined;
  const email = me?.email;
  const initial = (name || email || "?").charAt(0).toUpperCase();
  const streak = overview ? streakFrom(overview.activity) : 0;

  const avatar = (size: string) => (
    <span className={`grid shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground ${size}`}>{initial}</span>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" aria-label="Account" className="data-[state=open]:bg-sidebar-accent">
          {avatar("size-8 text-sm")}
          <span className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="truncate font-medium">{name || "Account"}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </span>
          <ChevronsUpDownIcon className="ml-auto text-muted-foreground" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-(--radix-dropdown-menu-trigger-width) min-w-64 p-1.5">
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
          {avatar("size-10 text-base")}
          <span className="grid min-w-0 leading-tight">
            <span className="truncate font-semibold text-foreground">{name || "Your account"}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </span>
        </DropdownMenuLabel>

        {/* Your week at a glance */}
        {overview && (
          <div className="mx-1 mb-1.5 grid grid-cols-3 rounded-lg bg-foreground/5 py-2 text-center" aria-label="Your week">
            {[
              [String(streak), "day streak"],
              [String(overview.week.reviewed), "cards"],
              [overview.week.focusMinutes ? `${overview.week.focusMinutes}m` : "0m", "focused"],
            ].map(([value, label], i) => (
              <div key={label} className={i > 0 ? "border-l border-foreground/10" : undefined}>
                <p className="text-base font-semibold tabular-nums">{value}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {pet && (
            <DropdownMenuItem
              onSelect={() => {
                onNavigate();
                openPet();
              }}
            >
              <span className="grid size-4 place-items-end justify-center overflow-hidden">
                <PetSprite look={pet} className="h-4 w-[15px]" />
              </span>
              {pet.name}
              <span className="ml-auto text-xs text-muted-foreground">Lv {petLevel(pet.xp).level}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href="/settings" onClick={onNavigate}>
              <SettingsIcon />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <PaletteIcon />
              Appearance
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-40">
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">
                  <SunIcon />
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <MoonIcon />
                  Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <MonitorIcon />
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
