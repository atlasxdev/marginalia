"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { signOut } from "@/app/actions/auth";
import { conversationsQuery, documentsQuery } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-dvh">
      <aside
        // Close the mobile drawer when a link inside it is followed
        onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-rule bg-paper transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Suspense>
          <Sidebar />
        </Suspense>
      </aside>
      {open && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-20 bg-ink/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-rule px-4 py-3 md:hidden">
          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="-ml-1 rounded-md p-1.5 hover:bg-sheet"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
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

      <div className="space-y-1 px-3">
        <Link
          href="/chat"
          className="flex items-center gap-2.5 rounded-md bg-ink px-3 py-2 text-sm font-medium text-paper hover:opacity-90"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          New question
        </Link>
        <Link
          href="/library"
          aria-current={pathname === "/library" ? "page" : undefined}
          className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-sheet aria-[current=page]:bg-sheet aria-[current=page]:font-medium"
        >
          Library
          {readyCount !== undefined && (
            <span className="text-xs text-ink-soft tabular-nums">{readyCount} ready</span>
          )}
        </Link>
      </div>

      <h2 className="mt-6 px-6 pb-2 text-xs font-medium text-ink-soft">Conversations</h2>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {isPending &&
          [0, 1, 2].map((i) => (
            <li key={i} className="mx-3 my-2.5 h-3.5 animate-pulse rounded bg-rule/70" />
          ))}
        {conversations?.length === 0 && (
          <li className="px-3 py-2 text-sm text-ink-soft">Your questions will show up here.</li>
        )}
        {conversations?.map((c) => {
          const href = `/chat/${c.id}`;
          return (
            <li key={c.id}>
              <Link
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className="block truncate rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-sheet hover:text-ink aria-[current=page]:bg-sheet aria-[current=page]:text-ink"
              >
                {c.title}
              </Link>
            </li>
          );
        })}
      </ul>

      <form action={signOut} className="border-t border-rule px-3 py-3">
        <div className="flex items-center justify-between px-3">
          <span className="truncate text-sm">ace@example.com</span>
          <button type="submit" className="text-sm text-ink-soft hover:text-ink">
            Sign out
          </button>
        </div>
      </form>
    </nav>
  );
}
