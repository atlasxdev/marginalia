"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronsUpDownIcon,
  LayersIcon,
  LibraryIcon,
  LogOutIcon,
  MoonIcon,
  PawPrintIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SquarePenIcon,
  SunIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { conversationsQuery, documentsQuery, meQuery, spacesQuery } from "@/lib/queries";
import type { ConversationSummary } from "@/lib/types";
import { getBrowserClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { Wordmark } from "./logo";
import { DeleteConversation, RenameConversation } from "./conversation-actions";
import { ConversationGroups } from "./conversation-list";
import { SearchChats } from "./search-chats";
import { MarginPet } from "./pet/margin-pet";
import { openPetBuilder } from "@/lib/pet-events";
import { setSoundsOn, soundsOn, subscribeSounds } from "@/lib/pet-sounds";
import { SpaceDialog } from "./space-dialog";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-dvh min-h-0">
      <Suspense>
        <AppSidebar />
      </Suspense>
      <SidebarInset className="min-w-0 bg-transparent">
        <header className="glass flex items-center gap-2 border-b border-glass-border bg-glass px-3 py-2 md:hidden">
          <SidebarTrigger aria-label="Open menu" />
          <Wordmark className="text-[22px]" />
        </header>
        {/* Pages render from client data, so they stream in after the shell */}
        <div className="min-h-0 flex-1">
          <Suspense>{children}</Suspense>
        </div>
      </SidebarInset>
      <MarginPet />
    </SidebarProvider>
  );
}

const SLIDE_IN = "animate-in fade-in slide-in-from-left-2 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none";

/** True for ids that weren't in the list when it first loaded. */
function useFresh(ids: string[] | undefined) {
  const [first, setFirst] = useState<ReadonlySet<string> | null>(null);
  if (ids && first === null) setFirst(new Set(ids));
  return (id: string) => first !== null && !first.has(id);
}

function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const { setOpenMobile } = useSidebar();
  const conversationsResult = useQuery(conversationsQuery);
  const documentsResult = useQuery(documentsQuery);
  const spacesResult = useQuery(spacesQuery);
  const conversations = hydrated ? conversationsResult.data : undefined;
  const documents = hydrated ? documentsResult.data : undefined;
  const spaces = hydrated ? spacesResult.data : undefined;
  const isPending = !hydrated || conversationsResult.isPending;
  const readyCount = documents?.filter((d) => d.status === "ready").length;
  const meResult = useQuery(meQuery);
  const me = meResult.data;
  const email = me?.email;
  // A session ended elsewhere (like a password reset) still has a cookie, so sign out properly
  useEffect(() => {
    if (!meResult.isSuccess || me) return;
    getBrowserClient()
      .auth.signOut({ scope: "local" })
      .finally(() => router.replace("/sign-in"));
  }, [meResult.isSuccess, me, router]);
  const name = me?.user_metadata?.name as string | undefined;
  const { resolvedTheme, setTheme } = useTheme();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ConversationSummary | null>(null);
  const [renaming, setRenaming] = useState<ConversationSummary | null>(null);
  const [searching, setSearching] = useState(false);
  const sounds = useSyncExternalStore(subscribeSounds, soundsOn, () => true);
  // ⌘K / Ctrl+K opens search from anywhere in the app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearching((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Following a link closes the menu on phones
  const close = () => setOpenMobile(false);
  // Only items added while you're here slide in, not the whole list on load
  const freshSpace = useFresh(spaces?.map((s) => s.id));
  const freshChat = useFresh(conversations?.map((c) => c.id));

  return (
    <Sidebar
      variant="floating"
      className="*:data-[slot=sidebar-inner]:glass *:data-[slot=sidebar-inner]:rounded-2xl *:data-[slot=sidebar-inner]:ring-glass-border"
    >
      <SidebarHeader className="flex-row items-center justify-between pt-4 pr-3 pb-3 pl-5">
        <Link href="/chat" aria-label="Marginalia home" onClick={close}>
          <Wordmark className="text-[22px]" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-2 px-1.5 [&_[data-sidebar=menu-button]]:h-9 [&_[data-sidebar=menu-action]]:top-2 [&_[data-sidebar=menu-badge]]:top-2 [&_[data-sidebar=menu]]:gap-0.5">
        <SidebarGroup className="py-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/chat"}>
                <Link href="/chat" onClick={close}>
                  <SquarePenIcon className="text-primary" />
                  <span>New chat</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setSearching(true)}>
                <SearchIcon className="text-primary" />
                <span>Search chats</span>
                <kbd className="ml-auto rounded border border-border px-1 font-sans text-[10px] text-muted-foreground">⌘K</kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/library" || pathname.startsWith("/library/")}>
                <Link href="/library" onClick={close}>
                  <LibraryIcon className="text-primary" />
                  <span>Library</span>
                </Link>
              </SidebarMenuButton>
              {readyCount !== undefined && <SidebarMenuBadge className="tabular-nums">{readyCount}</SidebarMenuBadge>}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Spaces</SidebarGroupLabel>
          <SidebarGroupAction aria-label="New space" title="New space" onClick={() => setCreating(true)}>
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {spaces?.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">Group documents for focused answers</p>
              )}
              {spaces?.map((s) => {
                const href = `/spaces/${s.id}`;
                return (
                  <SidebarMenuItem key={s.id} className={cn(freshSpace(s.id) && SLIDE_IN)}>
                    <SidebarMenuButton asChild isActive={pathname === href}>
                      <Link href={href} onClick={close}>
                        <LayersIcon className="text-primary" />
                        <span>{s.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <ConversationGroups
          conversations={conversations}
          isPending={isPending}
          pathname={pathname}
          close={close}
          onRename={setRenaming}
          onDelete={setDeleting}
          fresh={freshChat}
        />
      </SidebarContent>

      <SidebarFooter className="border-t border-glass-divider p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" aria-label="Account" className="data-[state=open]:bg-sidebar-accent">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {(name || email || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{name || "Account"}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </span>
                  <ChevronsUpDownIcon className="ml-auto text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                <DropdownMenuItem asChild>
                  <Link href="/settings" onClick={close}>
                    <SettingsIcon />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { close(); openPetBuilder(); }}>
                  <PawPrintIcon />
                  Your pet
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSoundsOn(!sounds); }}>
                  {sounds ? <Volume2Icon /> : <VolumeXIcon />}
                  Pet sounds
                  <span className="ml-auto text-xs text-muted-foreground">{sounds ? "On" : "Off"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                  {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
                  {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut()}>
                  <LogOutIcon />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SpaceDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(id) => {
          router.push(`/spaces/${id}`);
          close();
        }}
      />
      <SearchChats open={searching} onOpenChange={setSearching} conversations={conversations} onNavigate={close} />
      <RenameConversation conversation={renaming} onClose={() => setRenaming(null)} />
      <DeleteConversation
        conversation={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(id) => {
          if (pathname === `/chat/${id}`) router.push("/chat");
        }}
      />
    </Sidebar>
  );
}
