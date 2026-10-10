"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MenuIcon, PlusIcon } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { conversationsQuery, documentsQuery } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";
import { ThemeToggle } from "./theme-toggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-dvh">
      <aside className="hidden w-72 shrink-0 border-r md:block">
        <Suspense>
          <Sidebar />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-3 py-2.5 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-background p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              {/* Close the drawer when a link inside it is followed */}
              <div className="h-full" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
                <Suspense>
                  <Sidebar />
                </Suspense>
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-semibold tracking-tight">Marginalia</span>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const conversationsResult = useQuery(conversationsQuery);
  const documentsResult = useQuery(documentsQuery);
  const conversations = hydrated ? conversationsResult.data : undefined;
  const documents = hydrated ? documentsResult.data : undefined;
  const isPending = !hydrated || conversationsResult.isPending;
  const readyCount = documents?.filter((d) => d.status === "ready").length;

  return (
    <nav className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-4">
        <Link href="/chat" className="text-lg font-semibold tracking-tight">
          Marginalia
        </Link>
      </div>

      <div className="grid gap-1 px-3">
        <Button asChild size="lg" className="justify-start gap-2.5 px-3">
          <Link href="/chat">
            <PlusIcon />
            New question
          </Link>
        </Button>
        <Link
          href="/library"
          aria-current={pathname === "/library" ? "page" : undefined}
          className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:shadow-lift-1"
        >
          Library
          {readyCount !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">{readyCount} ready</span>
          )}
        </Link>
      </div>

      <h2 className="mt-6 px-6 pb-2 text-xs font-medium text-muted-foreground">Conversations</h2>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {isPending &&
          [0, 1, 2].map((i) => (
            <li key={i} className="px-3 py-2.5">
              <Skeleton className="h-3.5 w-4/5" />
            </li>
          ))}
        {conversations?.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Your questions will show up here.</li>
        )}
        {conversations?.map((c) => {
          const href = `/chat/${c.id}`;
          return (
            <li key={c.id}>
              <Link
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className="block truncate rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-foreground aria-[current=page]:shadow-lift-1"
              >
                {c.title}
              </Link>
            </li>
          );
        })}
      </ul>

      <form action={signOut} className="flex items-center gap-1 border-t px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate px-2 text-sm">ace@example.com</span>
        <ThemeToggle />
        <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
          Sign out
        </Button>
      </form>
    </nav>
  );
}
