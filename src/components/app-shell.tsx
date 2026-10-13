"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  HouseIcon,
  LayersIcon,
  LibraryIcon,
  ListMusicIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
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
import { isDue } from "@/lib/leitner";
import {
  conversationsQuery,
  documentsQuery,
  meQuery,
  spacesQuery,
  studyQuery,
} from "@/lib/queries";
import { getBrowserClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { Wordmark } from "./logo";
import { SearchChats } from "./search-chats";
import { PetWidget } from "./pet/pet-widget";
import { SpaceDialog } from "./space-dialog";
import { AccountMenu } from "./account-menu";
import { NowPlaying } from "./music/music-button";
import { AutoCards } from "@/lib/auto-cards";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
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
      </SidebarProvider>
      <AutoCards />
    </>
  );
}

const SLIDE_IN =
  "animate-in fade-in slide-in-from-left-2 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none";

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
  // On a chat, its subject stays highlighted
  const chatSubject = pathname.startsWith("/chat/") ? conversations?.find((c) => pathname === `/chat/${c.id}`)?.spaceId : undefined;
  const documents = hydrated ? documentsResult.data : undefined;
  const spaces = hydrated ? spacesResult.data : undefined;
  const readyCount = documents?.filter((d) => d.status === "ready").length;
  const studyResult = useQuery(studyQuery);
  const dueCount = hydrated
    ? studyResult.data?.decks.reduce(
        (n, d) =>
          n +
          d.payload.cards.filter((_, i) => isDue(d.state.cards?.[i])).length,
        0,
      )
    : undefined;
  const meResult = useQuery(meQuery);
  const me = meResult.data;
  // A session ended elsewhere (like a password reset) still has a cookie, so sign out properly
  useEffect(() => {
    if (!meResult.isSuccess || me) return;
    getBrowserClient()
      .auth.signOut({ scope: "local" })
      .finally(() => router.replace("/sign-in"));
  }, [meResult.isSuccess, me, router]);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
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

  return (
    <Sidebar
      variant="floating"
      className="*:data-[slot=sidebar-inner]:glass *:data-[slot=sidebar-inner]:rounded-2xl *:data-[slot=sidebar-inner]:ring-glass-border"
    >
      <SidebarHeader className="flex-row items-center justify-between pt-4 pr-3 pb-3 pl-5">
        <Link href="/study" aria-label="Marginalia home" onClick={close}>
          <Wordmark className="text-[22px]" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-2 px-1.5 [&_[data-sidebar=menu-button]]:h-9 [&_[data-sidebar=menu-action]]:top-2 [&_[data-sidebar=menu-badge]]:top-2 [&_[data-sidebar=menu]]:gap-0.5">
        <SidebarGroup className="py-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/study"}>
                <Link href="/study" onClick={close}>
                  <HouseIcon className="text-primary" />
                  <span>Today</span>
                </Link>
              </SidebarMenuButton>
              {!!dueCount && (
                <SidebarMenuBadge
                  className="tabular-nums"
                  aria-label={`${dueCount} cards due`}
                >
                  {dueCount}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setSearching(true)}>
                <SearchIcon className="text-primary" />
                <span>Search chats</span>
                <kbd className="ml-auto hidden rounded border border-border px-1 font-sans text-[10px] text-muted-foreground md:inline">
                  ⌘K
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={
                  pathname === "/library" || pathname.startsWith("/library/")
                }
              >
                <Link href="/library" onClick={close}>
                  <LibraryIcon className="text-primary" />
                  <span>Library</span>
                </Link>
              </SidebarMenuButton>
              {readyCount !== undefined && (
                <SidebarMenuBadge className="tabular-nums">
                  {readyCount}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/playlists"}>
                <Link href="/playlists" onClick={close}>
                  <ListMusicIcon className="text-primary" />
                  <span>Playlists</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Subjects</SidebarGroupLabel>
          <SidebarGroupAction
            aria-label="New subject"
            title="New subject"
            onClick={() => setCreating(true)}
          >
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {spaces?.length === 0 && (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="px-2 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground"
                >
                  Add your first class
                </button>
              )}
              {spaces?.map((s) => {
                const href = `/spaces/${s.id}`;
                return (
                  <SidebarMenuItem
                    key={s.id}
                    className={cn(freshSpace(s.id) && SLIDE_IN)}
                  >
                    <SidebarMenuButton asChild isActive={pathname === href || pathname.startsWith(`${href}/`) || chatSubject === s.id}>
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

      </SidebarContent>

      <SidebarFooter className="border-t border-glass-divider p-2">
        <NowPlaying />
        <PetWidget onOpen={close} />
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountMenu onNavigate={close} />
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
      <SearchChats
        open={searching}
        onOpenChange={setSearching}
        conversations={conversations}
        onNavigate={close}
      />
    </Sidebar>
  );
}
