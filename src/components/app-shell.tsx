"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LibraryIcon, MenuIcon, SquarePenIcon } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { conversationsQuery, documentsQuery } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-dvh">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar backdrop-blur-xl md:block">
        <Suspense>
          <Sidebar />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 backdrop-blur-xl">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              {/* Close the drawer when a link inside it is followed */}
              <div className="h-full" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
                <Suspense>
                  <Sidebar />
                </Suspense>
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-semibold">Marginalia</span>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

const itemClass =
  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-primary aria-[current=page]:text-sidebar-primary-foreground";

function Sidebar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const conversationsResult = useQuery(conversationsQuery);
  const documentsResult = useQuery(documentsQuery);
  const conversations = hydrated ? conversationsResult.data : undefined;
  const documents = hydrated ? documentsResult.data : undefined;
  const isPending = !hydrated || conversationsResult.isPending;
  const readyCount = documents?.filter((d) => d.status === "ready").length;
  const libraryActive = pathname === "/library";

  return (
    <nav className="flex h-full flex-col">
      <div className="flex items-center justify-between py-3 pr-3 pl-5">
        <Link href="/chat" className="font-semibold">
          Marginalia
        </Link>
        <Button asChild variant="ghost" size="icon-sm" aria-label="New question">
          <Link href="/chat">
            <SquarePenIcon />
          </Link>
        </Button>
      </div>

      <div className="px-2.5">
        <Link href="/library" aria-current={libraryActive ? "page" : undefined} className={itemClass}>
          <LibraryIcon className={cn("size-4", !libraryActive && "text-primary")} />
          <span className="flex-1">Library</span>
          {readyCount !== undefined && (
            <span className={cn("text-xs tabular-nums", libraryActive ? "opacity-80" : "text-muted-foreground")}>
              {readyCount}
            </span>
          )}
        </Link>
      </div>

      <h2 className="mt-5 px-5 pb-1 text-xs font-semibold text-muted-foreground">Conversations</h2>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
        {isPending &&
          [0, 1, 2].map((i) => (
            <li key={i} className="px-2.5 py-2">
              <Skeleton className="h-3.5 w-4/5" />
            </li>
          ))}
        {conversations?.length === 0 && (
          <li className="px-2.5 py-1.5 text-sm text-muted-foreground">No conversations yet</li>
        )}
        {conversations?.map((c) => {
          const href = `/chat/${c.id}`;
          return (
            <li key={c.id}>
              <Link
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(itemClass, "block truncate")}
              >
                {c.title}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-1 border-t border-sidebar-border px-3 py-2">
        <span className="min-w-0 flex-1 truncate px-2 text-sm text-muted-foreground">ace@example.com</span>
        <ThemeToggle />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </nav>
  );
}
