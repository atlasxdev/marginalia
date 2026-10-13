"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRightIcon, FileTextIcon, LayersIcon, MessageSquareIcon, MoreHorizontalIcon, PencilIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { deleteSpace } from "@/app/actions/spaces";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { conversationsQuery, documentsQuery, spaceQuery, studyQuery } from "@/lib/queries";
import type { DocumentItem, Space } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { Composer } from "./composer";
import { DeckList, useMakeDeck } from "./deck";
import { MethodPicker } from "./method-picker";
import { KindIcon, SpaceDialog } from "./space-dialog";

const groupClass = "glass rounded-xl border border-glass-border bg-glass";

export function SpaceView({ id }: { id: string }) {
  const hydrated = useHydrated();
  const query = useQuery(spaceQuery(id));
  const space = hydrated ? query.data : undefined;
  const error = hydrated ? query.error : null;

  if (error) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayersIcon />
          </EmptyMedia>
          <EmptyTitle>This subject isn&apos;t available</EmptyTitle>
          <EmptyDescription>It may have been deleted.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/chat">Ask a new question</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 sm:px-8 lg:px-12 pt-14 pb-24">
        {space ? (
          <SpaceDetail key={space.id} space={space} />
        ) : (
          <div className="space-y-4" aria-label="Loading subject">
            <Skeleton className="h-9 w-1/2" />
            <Skeleton className="h-12 w-full rounded-3xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        )}
      </div>
    </div>
  );
}

function SpaceDetail({ space }: { space: Space }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const hydrated = useHydrated();
  const library = useQuery(documentsQuery).data;
  const allConversations = useQuery(conversationsQuery).data;
  const documents = (hydrated ? library : undefined) ?? [];
  const inSpace = documents.filter((d) => space.documentIds.includes(d.id));
  const chats = (hydrated ? allConversations : undefined)?.filter((c) => c.spaceId === space.id) ?? [];
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const makeDeck = useMakeDeck();
  // Reviewers made from this subject or from one of its files
  const study = useQuery(studyQuery).data;
  const decks =
    (hydrated ? study : undefined)?.decks.filter(
      (d) => d.spaceId === space.id || (d.documentId && space.documentIds.includes(d.documentId))
    ) ?? [];

  const remove = useMutation({
    mutationFn: () => deleteSpace(space.id),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message ?? "Couldn't delete this subject. Try again.");
        return;
      }
      toast.success(`“${space.name}” deleted`);
      queryClient.removeQueries({ queryKey: ["spaces", space.id] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.push("/chat");
    },
  });

  return (
    <>
      <div className="flex items-start gap-2">
        <h1 className="min-w-0 flex-1 text-3xl font-bold tracking-tight wrap-anywhere">{space.name}</h1>
        {inSpace.some((d) => d.status === "ready") && (
          <Button
            disabled={makeDeck.isPending}
            onClick={() => makeDeck.mutate({ body: { spaceId: space.id }, name: space.name })}
          >
            <SparklesIcon />
            Make a reviewer
          </Button>
        )}
        <Button variant="glass" onClick={() => setEditing(true)}>
          <PencilIcon />
          Edit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More options for this subject" className="text-muted-foreground">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-48">
            <DropdownMenuItem variant="destructive" className="gap-2.5 px-2.5 py-2" onSelect={() => setConfirming(true)}>
              <Trash2Icon />
              Delete subject
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-2 text-muted-foreground">
        {inSpace.length === 0
          ? "Add your notes for this class, then ask questions or make a reviewer from them."
          : `Answers and reviewers come only from ${inSpace.length === 1 ? "this file" : `these ${inSpace.length} files`}.`}
      </p>

      <div className="mt-4 flex justify-end">
        <MethodPicker spaceId={space.id} />
      </div>
      <div className="mt-3">
        <Composer spaceId={space.id} placeholder={`Ask ${space.name}`} busy={space.documentIds.length === 0} className="max-w-none" />
      </div>

      {decks.length > 0 && (
        <section aria-labelledby="space-decks" className="mt-14">
          <h2 id="space-decks" className="text-xl font-semibold">
            Reviewers
          </h2>
          <div className="mt-4">
            <DeckList decks={decks} />
          </div>
        </section>
      )}

      {/* Documents */}
      <section aria-labelledby="space-documents" className="mt-14">
        <h2 id="space-documents" className="text-xl font-semibold">
          Files
        </h2>
        <div className="mt-4">
          {inSpace.length === 0 ? (
            <Empty className={groupClass}>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>No files yet</EmptyTitle>
                <EmptyDescription>Pick notes from your library, or upload new ones.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setEditing(true)}>Add files</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ItemGroup className={`${groupClass} gap-0`}>
              {inSpace.map((doc, i) => (
                <Fragment key={doc.id}>
                  {i > 0 && <ItemSeparator className="my-0 bg-glass-divider" />}
                  <Item className="px-5 py-4">
                    <ItemMedia>
                      <KindIcon doc={doc} className="size-9 rounded-lg" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="text-[15px]">{doc.filename}</ItemTitle>
                    </ItemContent>
                    <DocStatus doc={doc} />
                  </Item>
                </Fragment>
              ))}
            </ItemGroup>
          )}
        </div>
      </section>

      {/* Instructions, when set */}
      {space.instructions && (
        <section aria-labelledby="space-instructions" className="mt-14">
          <h2 id="space-instructions" className="text-xl font-semibold">
            Instructions
          </h2>
          <Item className={`${groupClass} mt-4 px-5 py-4`}>
            <ItemContent className="min-w-0">
              <p className="whitespace-pre-wrap wrap-anywhere">{space.instructions}</p>
            </ItemContent>
          </Item>
        </section>
      )}

      {/* Chats */}
      <section aria-labelledby="space-chats" className="mt-14">
        <h2 id="space-chats" className="text-xl font-semibold">
          Chats
        </h2>
        <div className="mt-4">
          {chats.length === 0 ? (
            <p className="text-muted-foreground">No chats yet. Ask a question above to start one.</p>
          ) : (
            <ItemGroup className={`${groupClass} gap-0`}>
              {chats.map((c, i) => (
                <Fragment key={c.id}>
                  {i > 0 && <ItemSeparator className="my-0 bg-glass-divider" />}
                  <Item asChild className="rounded-none px-5 py-4 first:rounded-t-xl last:rounded-b-xl hover:bg-glass-strong">
                    <Link href={`/chat/${c.id}`}>
                      <ItemMedia>
                        <MessageSquareIcon className="size-4 text-muted-foreground" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="text-[15px]">{c.title}</ItemTitle>
                      </ItemContent>
                      <ItemActions>
                        <ChevronRightIcon className="size-4 text-muted-foreground" />
                      </ItemActions>
                    </Link>
                  </Item>
                </Fragment>
              ))}
            </ItemGroup>
          )}
        </div>
      </section>

      <SpaceDialog open={editing} onOpenChange={setEditing} space={space} />
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="glass border border-glass-border bg-glass-strong data-[size=default]:sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{space.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its files stay in your library, and its reviewers are deleted. Its chats stay in your history and will search all your files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DocStatus({ doc }: { doc: DocumentItem }) {
  if (doc.status === "ready") return null;
  if (doc.status === "failed") return <span className="shrink-0 text-sm text-destructive">Couldn&apos;t read</span>;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
      <Spinner />
      Indexing
    </span>
  );
}
