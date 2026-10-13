"use client";

import { Fragment, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRightIcon, FileTextIcon, LayersIcon, MessageSquareIcon, MoreHorizontalIcon, PencilIcon, PlayIcon, SparklesIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { deleteSpace, saveSpace } from "@/app/actions/spaces";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { queueCards, useCardQueue } from "@/lib/auto-cards";
import { fileLabel, petSignal } from "@/lib/pet-events";
import { conversationsQuery, documentsQuery, spaceQuery, studyQuery } from "@/lib/queries";
import { ACCEPTED_TYPES } from "@/lib/schemas";
import { cardCounts, dueCount, sessionHref, subjectDecks, topicsIn, waitingLine } from "@/lib/subjects";
import type { DocumentItem, Space } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { DeckList, useMakeDeck } from "./deck";
import { MethodPicker } from "./method-picker";
import { KindIcon, SpaceDialog } from "./space-dialog";
import { WeakTopicList } from "./study-hub";
import { uploadFile } from "./upload-form";

const groupClass = "glass rounded-xl border border-glass-border bg-glass";
const ACCEPT = Object.values(ACCEPTED_TYPES).join(",");

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
            <Link href="/study">Back to Today</Link>
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
  const readyFiles = inSpace.filter((d) => d.status === "ready").length;
  const chats = (hydrated ? allConversations : undefined)?.filter((c) => c.spaceId === space.id) ?? [];
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const makeDeck = useMakeDeck();
  const study = useQuery(studyQuery).data;
  const overview = hydrated ? study : undefined;
  const decks = overview ? subjectDecks(overview.decks, space) : [];
  const due = dueCount(decks);
  const weak = overview ? topicsIn(overview.weakTopics, decks) : [];
  const cards = decks.reduce((n, d) => n + d.payload.cards.length, 0);
  const fileRef = useRef<HTMLInputElement>(null);
  // Files still being read, or waiting for their flashcards
  const queue = useCardQueue();
  const preparing = inSpace.some((d) => queue.includes(d.id) || d.status === "pending" || d.status === "processing");

  // Uploading here adds the file to this subject
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { id } = await uploadFile(file);
      const result = await saveSpace({ id: space.id, name: space.name, instructions: space.instructions, documentIds: [...space.documentIds, id] });
      if (!result.ok) throw new Error(result.message ?? "Uploaded, but couldn't add it to this subject.");
      queueCards([id]);
      return file;
    },
    onSuccess: (file) => {
      toast.success(`Added ${file.name}. Making flashcards from it…`);
      petSignal({ kind: "notes", label: fileLabel(file.name) });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "Couldn't upload that file. Try again."),
  });

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
      router.push("/study");
    },
  });

  const uploadButton = (variant: "default" | "outline") => (
    <Button variant={variant} disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
      {upload.isPending ? <Spinner /> : <UploadIcon />}
      {upload.isPending ? "Uploading…" : "Upload notes"}
    </Button>
  );

  // The one next step for this subject: add notes, wait for the cards, study
  const next =
    inSpace.length === 0
      ? { line: "Add the notes for this class. Your buddy turns them into flashcards.", action: uploadButton("default") }
      : decks.length === 0 && (preparing || makeDeck.isPending)
        ? {
            line: "Reading your notes and writing flashcards. This takes a few seconds.",
            action: (
              <Button disabled>
                <Spinner />
                Making your flashcards…
              </Button>
            ),
          }
        : decks.length === 0
          ? {
              line: "Your notes are in. Make flashcards from them to start studying.",
              action: (
                <Button disabled={!readyFiles} onClick={() => makeDeck.mutate({ body: { spaceId: space.id }, name: space.name })}>
                  <SparklesIcon />
                  Make flashcards
                </Button>
              ),
            }
          : {
              line: [
                due
                  ? `${waitingLine(cardCounts(decks))}${weak[0] ? `, and ${weak[0].topic} needs work` : ""}.`
                  : weak[0]
                    ? `All caught up. ${weak[0].topic} could use another go.`
                    : "All caught up. Practise to stay sharp.",
                preparing && "More cards are on the way from your new notes.",
              ]
                .filter(Boolean)
                .join(" "),
              action: (
                <Button size="lg" asChild className="h-12 px-6 text-base">
                  <Link href={sessionHref({ subject: space.id })}>
                    <PlayIcon />
                    Start studying
                  </Link>
                </Button>
              ),
            };

  const counts = cardCounts(decks);
  const learned = Math.max(0, cards - counts.review - counts.fresh);

  return (
    <>
      {/* Header: the subject, and its one next step */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-bold tracking-tight wrap-anywhere">{space.name}</h1>
          <p className="mt-1.5 text-muted-foreground">
            {inSpace.length === 0
              ? "No notes yet"
              : `${inSpace.length} ${inSpace.length === 1 ? "file" : "files"}${cards ? `, ${cards} flashcards` : ""}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Edit subject" onClick={() => setEditing(true)} className="text-muted-foreground">
          <PencilIcon />
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
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload.mutate(file);
        }}
      />

      <section aria-label="Next step" className={`${groupClass} mt-8 rounded-2xl p-6`}>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <div className="min-w-60 flex-1">
            {cards > 0 && (
              <div className="mb-4 grid gap-2">
                <div className="flex h-2 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
                  <div className="bg-success transition-[width] duration-500" style={{ width: `${(learned / cards) * 100}%` }} />
                  <div className="bg-primary transition-[width] duration-500" style={{ width: `${(counts.review / cards) * 100}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <Legend className="bg-success" label={`${learned} learned`} />
                  <Legend className="bg-primary" label={`${counts.review} to review`} />
                  <Legend className="bg-foreground/20" label={`${counts.fresh} new`} />
                </div>
              </div>
            )}
            <p className="text-lg font-medium text-balance">{next.line}</p>
          </div>
          {next.action}
        </div>
      </section>

      <Tabs defaultValue={inSpace.length === 0 ? "notes" : "study"} className="mt-10 gap-6">
        <TabsList variant="line" className="h-10 w-full justify-start gap-6 border-b border-glass-divider p-0">
          <TabsTrigger value="study" className="flex-none px-0 text-base">
            Study
          </TabsTrigger>
          <TabsTrigger value="ask" className="flex-none px-0 text-base">
            Ask
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-none px-0 text-base">
            Notes
            <span className="text-muted-foreground tabular-nums">{inSpace.length}</span>
          </TabsTrigger>
        </TabsList>

        {/* Study: what needs work, and the flashcards */}
        <TabsContent value="study" className="grid gap-10">
          {weak.length > 0 && (
            <section aria-labelledby="space-weak">
              <h2 id="space-weak" className="text-lg font-semibold">
                Needs work
              </h2>
              <WeakTopicList topics={weak} subjectId={space.id} />
            </section>
          )}
          <section aria-labelledby="space-decks">
            <div className="flex items-center justify-between gap-3">
              <h2 id="space-decks" className="text-lg font-semibold">
                Flashcards
              </h2>
              {decks.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!readyFiles || makeDeck.isPending}
                  onClick={() => makeDeck.mutate({ body: { spaceId: space.id }, name: space.name })}
                >
                  <SparklesIcon />
                  Make more cards
                </Button>
              )}
            </div>
            <div className="mt-4">
              {decks.length > 0 ? (
                <DeckList decks={decks} />
              ) : (
                <p className="text-muted-foreground">
                  {inSpace.length === 0 ? "Add notes and your flashcards show up here." : preparing ? "Your flashcards are on the way." : "No flashcards yet."}
                </p>
              )}
            </div>
          </section>
        </TabsContent>

        {/* Ask: questions answered from this subject's notes */}
        <TabsContent value="ask" className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground">Answers come only from {space.name}&apos;s notes, with the line each fact came from.</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Answer style
              <MethodPicker spaceId={space.id} />
            </div>
          </div>
          <Composer spaceId={space.id} placeholder={`Ask about ${space.name}`} busy={space.documentIds.length === 0} className="max-w-none" />
          {chats.length > 0 && (
            <ItemGroup className={`${groupClass} gap-0`}>
              {chats.map((c, i) => (
                <Fragment key={c.id}>
                  {i > 0 && <ItemSeparator className="my-0 bg-glass-divider" />}
                  <Item asChild className="rounded-none px-5 py-3.5 first:rounded-t-xl last:rounded-b-xl hover:bg-glass-strong">
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
        </TabsContent>

        {/* Notes: the files this subject studies from */}
        <TabsContent value="notes" className="grid gap-4">
          {inSpace.length === 0 ? (
            <Empty className={groupClass}>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>No notes yet</EmptyTitle>
                <EmptyDescription>Upload PDFs, Word or Markdown files for this class, or pick ones already in your library.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row justify-center gap-2">
                {uploadButton("default")}
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Add from library
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground">New notes turn into flashcards on their own.</p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditing(true)}>
                    Add from library
                  </Button>
                  {uploadButton("outline")}
                </div>
              </div>
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
            </>
          )}
          {space.instructions && (
            <div className={`${groupClass} px-5 py-4`}>
              <p className="text-xs font-medium text-muted-foreground">Instructions for answers</p>
              <p className="mt-1 whitespace-pre-wrap wrap-anywhere">{space.instructions}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

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

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} aria-hidden />
      {label}
    </span>
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
