"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileTextIcon, LayersIcon, MessageSquareIcon, MoreHorizontalIcon, PlayIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { isDue } from "@/lib/leitner";
import { documentsQuery, spacesQuery } from "@/lib/queries";
import { sessionHref, type SessionScope } from "@/lib/subjects";
import type { CardProgress, Deck } from "@/lib/types";
import { makeDeck } from "@/lib/make-deck";
import { deleteAction } from "@/lib/writes";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item";

/** A deck's state in a few words: what's due, or when it's next due. */
export function deckStatus(total: number, due: number, progress: Record<string, CardProgress>) {
  if (due === total) return `${total} cards, all new`;
  if (due) return `${total} cards, ${due} to review now`;
  const next = Object.values(progress)
    .map((p) => p.due)
    .sort()[0];
  return next
    ? `All caught up. Next review ${new Date(next).toLocaleDateString(undefined, { weekday: "long" })}`
    : `${total} cards`;
}

/** Opens a study session on a deck. Flip, quiz and typed answers all happen inside it. */
export function StudyLink({ due, total, scope }: { due: number; total: number; scope: SessionScope }) {
  return (
    <Button variant={due ? "default" : "outline"} asChild>
      <Link href={sessionHref(scope)}>
        <PlayIcon />
        {due === total ? "Study" : due ? `Study ${due} due` : "Practice"}
      </Link>
    </Button>
  );
}

const ORIGIN_ICON = { chat: MessageSquareIcon, document: FileTextIcon, subject: LayersIcon };

/** Decks as a list, each opening a study session. */
export function DeckList({ decks }: { decks: Deck[] }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteAction(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <ItemGroup className="glass gap-0 rounded-xl border border-glass-border bg-glass">
        {decks.map((deck, i) => {
          const progress = deck.state.cards ?? {};
          const total = deck.payload.cards.length;
          const due = deck.payload.cards.filter((_, index) => isDue(progress[index])).length;
          const Icon = ORIGIN_ICON[deck.origin.kind];
          return (
            <div key={deck.id}>
              {i > 0 && <ItemSeparator className="my-0 bg-glass-divider" />}
              <Item className="flex-wrap gap-y-3 px-5 py-4">
                <ItemContent className="min-w-48">
                  <ItemTitle className="text-[15px]">{deck.payload.title}</ItemTitle>
                  <ItemDescription className="flex items-center gap-1.5">
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    {deck.origin.href ? (
                      <Link href={deck.origin.href} className="truncate hover:text-foreground hover:underline">
                        {deck.origin.label}
                      </Link>
                    ) : (
                      <span className="truncate">{deck.origin.label}</span>
                    )}
                  </ItemDescription>
                  <p className="text-xs text-muted-foreground">{deckStatus(total, due, progress)}</p>
                </ItemContent>
                <ItemActions className="flex-wrap">
                  <StudyLink due={due} total={total} scope={{ deck: deck.id, subject: deck.subjectId ?? undefined }} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`More for ${deck.payload.title}`} className="text-muted-foreground">
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate(deck.id)}>
                        <Trash2Icon />
                        Delete deck
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ItemActions>
              </Item>
            </div>
          );
        })}
      </ItemGroup>
    </>
  );
}

const cardCount = (n: number) => `${n} card${n === 1 ? "" : "s"}`;

/** Makes a reviewer from a document or subject, with a toast while it works. */
export function useMakeDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { body: { documentId: string } | { spaceId: string }; name: string }) => {
      const id = toast.loading(`Making a reviewer from ${input.name}…`);
      let total = 0;
      try {
        await makeDeck(input.body, (e) => {
          if (e.deck) total = (e.deck as { payload: { cards: unknown[] } }).payload.cards.length;
          if (e.total) total = e.total;
          if (e.done) return;
          toast.loading(`${cardCount(total)} so far. Adding more…`, { id });
          void queryClient.invalidateQueries({ queryKey: ["study"] });
        });
        toast.success(`Your reviewer is ready, with ${cardCount(total)}.`, { id });
      } catch (error) {
        toast.error((error as Error).message, { id });
        throw error;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["study"] }),
  });
}

/** Pick a document or subject to make a reviewer from. */
export function MakeDeckDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const hydrated = useHydrated();
  const documentsResult = useQuery(documentsQuery);
  const spacesResult = useQuery(spacesQuery);
  const documents = (hydrated ? documentsResult.data : undefined)?.filter((d) => d.status === "ready") ?? [];
  const spaces = (hydrated ? spacesResult.data : undefined)?.filter((s) => s.documentIds.length > 0) ?? [];
  const make = useMakeDeck();
  const [busy, setBusy] = useState(false);

  const pick = (body: { documentId: string } | { spaceId: string }, name: string) => {
    setBusy(true);
    onOpenChange(false);
    make.mutate({ body, name }, { onSettled: () => setBusy(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass gap-4 border border-glass-border bg-glass-strong sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Make a reviewer</DialogTitle>
          <DialogDescription>Your buddy reads it and writes flashcards on what you&apos;d be tested on.</DialogDescription>
        </DialogHeader>
        <Command className="rounded-xl border border-border bg-transparent">
          <CommandInput placeholder="Search your subjects and files" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nothing ready yet. Upload notes in your library first.</CommandEmpty>
            {spaces.length > 0 && (
              <CommandGroup heading="Subjects">
                {spaces.map((s) => (
                  <CommandItem key={s.id} value={`subject ${s.name}`} disabled={busy} onSelect={() => pick({ spaceId: s.id }, s.name)}>
                    <LayersIcon className="text-primary" />
                    <span className="truncate">{s.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{s.documentIds.length} files</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {documents.length > 0 && (
              <CommandGroup heading="Files">
                {documents.map((d) => (
                  <CommandItem key={d.id} value={`file ${d.filename}`} disabled={busy} onSelect={() => pick({ documentId: d.id }, d.filename)}>
                    <FileTextIcon className="text-muted-foreground" />
                    <span className="truncate">{d.filename}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** The "Make a reviewer" button, with its picker. */
export function MakeDeckButton({ variant = "default", size }: { variant?: "default" | "glass" | "outline"; size?: "lg" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <SparklesIcon />
        Make a reviewer
      </Button>
      <MakeDeckDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
