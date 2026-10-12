"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronsUpDownIcon,
  LayersIcon,
  LibraryIcon,
  LogOutIcon,
  MoonIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SettingsIcon,
  SquarePenIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "@/app/actions/auth";
import { deleteConversation } from "@/app/actions/chat";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
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
        <Button asChild variant="ghost" size="icon-sm" aria-label="New question">
          <Link href="/chat" onClick={close}>
            <SquarePenIcon />
          </Link>
        </Button>
      </SidebarHeader>

      <SidebarContent className="gap-2 px-1.5 [&_[data-sidebar=menu-button]]:h-9 [&_[data-sidebar=menu-action]]:top-2 [&_[data-sidebar=menu-badge]]:top-2 [&_[data-sidebar=menu]]:gap-0.5">
        <SidebarGroup className="py-0">
          <SidebarMenu>
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

        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isPending &&
                [0, 1, 2].map((i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton />
                  </SidebarMenuItem>
                ))}
              {conversations?.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">No conversations yet</p>
              )}
              {conversations?.map((c) => {
                const href = `/chat/${c.id}`;
                return (
                  <SidebarMenuItem key={c.id} className={cn(freshChat(c.id) && SLIDE_IN)}>
                    <SidebarMenuButton asChild isActive={pathname === href}>
                      <Link href={href} onClick={close}>
                        <span>{c.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction showOnHover aria-label={`More options for ${c.title}`}>
                          <MoreHorizontalIcon />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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

// Confirms, then removes a conversation; the sidebar list updates right away
export function DeleteConversation({
  conversation,
  onClose,
  onDeleted,
}: {
  conversation: { id: string; title: string } | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: deleteConversation,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["conversations"], exact: true });
      const previous = queryClient.getQueryData<ConversationSummary[]>(["conversations"]);
      queryClient.setQueryData<ConversationSummary[]>(["conversations"], (list) => list?.filter((c) => c.id !== id));
      return { previous };
    },
    onError: (_err, _id, ctx) => queryClient.setQueryData(["conversations"], ctx?.previous),
    onSuccess: (result, id, ctx) => {
      if (!result.ok) {
        toast.error(result.message ?? "Couldn't delete this conversation. Try again.");
        return queryClient.setQueryData(["conversations"], ctx?.previous);
      }
      toast.success("Conversation deleted");
      queryClient.removeQueries({ queryKey: ["conversations", id], exact: true });
      onDeleted?.(id);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["conversations"], exact: true }),
  });

  return (
    <AlertDialog open={!!conversation} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="glass border border-glass-border bg-glass-strong">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{conversation?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The conversation and its answers will be removed. Your documents stay in your library.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => conversation && remove.mutate(conversation.id)}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
