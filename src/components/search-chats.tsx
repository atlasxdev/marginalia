"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessageSquareIcon, PinIcon } from "lucide-react";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { conversationSearchQuery } from "@/lib/queries";
import type { ConversationSummary } from "@/lib/types";
import { sortConversations } from "./conversation-actions";

const RECENT = 8;

// "today", "yesterday", "3 days ago", then the date
function when(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Search chats (⌘K): your recent chats while it's empty, then every chat whose
 * title or messages mention what you typed, with the line that matched.
 * Opening a match finds it inside the chat.
 */
export function SearchChats({
  open,
  onOpenChange,
  conversations,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: ConversationSummary[] | undefined;
  /** Called after opening a chat, to close the sidebar on phones. */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searching = term.length >= 2;
  const results = useQuery({ ...conversationSearchQuery(term), enabled: open && searching });
  const recent = sortConversations(conversations ?? [], "updated").slice(0, RECENT);

  const type = (value: string) => {
    setQuery(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setTerm(value.trim()), 180);
  };
  const go = (href: string) => {
    onOpenChange(false);
    onNavigate?.();
    router.push(href);
  };
  const reset = (next: boolean) => {
    if (!next) {
      setQuery("");
      setTerm("");
    }
    onOpenChange(next);
  };
  const mark = (text: string) => {
    const at = text.toLowerCase().indexOf(term.toLowerCase());
    if (!searching || at < 0) return text;
    return (
      <>
        {text.slice(0, at)}
        <mark className="mark" data-active="true">{text.slice(at, at + term.length)}</mark>
        {text.slice(at + term.length)}
      </>
    );
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={reset}
      title="Search chats"
      description="Find a conversation by its title or anything said in it"
      className="glass border border-glass-border bg-glass-strong sm:max-w-2xl"
    >
      <Command shouldFilter={false} className="bg-transparent">
        <CommandInput value={query} onValueChange={type} placeholder="Search chats" />
        <CommandList className="max-h-[min(26rem,60dvh)]">
          {!searching ? (
            recent.length > 0 ? (
              <CommandGroup heading="Recent chats">
                {recent.map((c) => (
                  <CommandItem key={c.id} value={c.id} onSelect={() => go(`/chat/${c.id}`)} className="gap-3 py-2">
                    {c.pinned ? <PinIcon className="text-primary" /> : <MessageSquareIcon className="text-muted-foreground" />}
                    <span className="flex-1 truncate">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{when(c.updatedAt)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty>No chats yet. Ask a question to start one.</CommandEmpty>
            )
          ) : results.isPending ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Spinner />
              Searching…
            </div>
          ) : results.data?.length ? (
            <CommandGroup heading="Chats">
              {results.data.map((h) => (
                <CommandItem
                  key={h.id}
                  value={h.id}
                  onSelect={() => go(`/chat/${h.id}?find=${encodeURIComponent(term)}`)}
                  className="items-start gap-3 py-2"
                >
                  <MessageSquareIcon className="mt-0.5 text-muted-foreground" />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex items-baseline gap-3">
                      <span className="flex-1 truncate font-medium">{mark(h.title)}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{when(h.updatedAt)}</span>
                    </span>
                    {h.snippet && <span className="line-clamp-2 text-xs text-muted-foreground">{mark(h.snippet)}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : (
            <CommandEmpty>No chats mention “{term}”.</CommandEmpty>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
