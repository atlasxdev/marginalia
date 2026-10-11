"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, MessageSquareIcon, PencilIcon, Trash2Icon } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { conversationsQuery, documentsQuery, spaceQuery } from "@/lib/queries";
import type { DocumentItem, Space } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { Composer } from "./composer";
import { KindIcon, SpaceDialog } from "./space-dialog";

const listClass = "glass border border-glass-border bg-glass divide-y divide-glass-divider overflow-hidden rounded-xl";

export function SpaceView({ id }: { id: string }) {
  const hydrated = useHydrated();
  const query = useQuery(spaceQuery(id));
  const space = hydrated ? query.data : undefined;
  const error = hydrated ? query.error : null;

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">This space isn&apos;t available</h1>
        <p className="mt-2 text-muted-foreground">It may have been deleted.</p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/chat">Ask a new question</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-6">
        {space ? (
          <SpaceDetail key={space.id} space={space} />
        ) : (
          <div className="space-y-4" aria-label="Loading space">
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

  const remove = useMutation({
    mutationFn: () => deleteSpace(space.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["spaces", space.id] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.push("/chat");
    },
  });

  return (
    <>
      <div className="flex items-start gap-2">
        <h1 className="min-w-0 flex-1 text-3xl font-bold tracking-tight break-words">{space.name}</h1>
        <Button variant="glass" onClick={() => setEditing(true)}>
          <PencilIcon />
          Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Delete space" className="text-muted-foreground hover:text-destructive">
              <Trash2Icon />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass border border-glass-border bg-glass-strong">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{space.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                Its documents stay in your library. Its chats stay in your history and will search all your documents.
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
      </div>
      <p className="mt-1 text-muted-foreground">
        {inSpace.length === 0
          ? "Add documents, then ask questions that are answered only from them."
          : `Answers come only from ${inSpace.length === 1 ? "this document" : `these ${inSpace.length} documents`}.`}
      </p>

      <div className="mt-6">
        <Composer spaceId={space.id} placeholder={`Ask ${space.name}`} busy={space.documentIds.length === 0} />
      </div>

      {/* Documents */}
      <section aria-labelledby="space-documents" className="mt-10">
        <h2 id="space-documents" className="text-xl font-semibold">
          Documents
        </h2>
        <div className="mt-3">
          {inSpace.length === 0 ? (
            <div className="glass rounded-xl border border-glass-border bg-glass px-4 py-8 text-center">
              <p className="text-muted-foreground">No documents yet.</p>
              <Button className="mt-3" onClick={() => setEditing(true)}>
                Add documents
              </Button>
            </div>
          ) : (
            <ul className={listClass}>
              {inSpace.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <KindIcon doc={doc} className="size-9 rounded-lg" />
                  <p className="min-w-0 flex-1 truncate font-medium">{doc.filename}</p>
                  <DocStatus doc={doc} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Instructions, when set */}
      {space.instructions && (
        <section aria-labelledby="space-instructions" className="mt-10">
          <h2 id="space-instructions" className="text-xl font-semibold">
            Instructions
          </h2>
          <p className="glass mt-3 rounded-xl border border-glass-border bg-glass px-4 py-3 whitespace-pre-wrap">
            {space.instructions}
          </p>
        </section>
      )}

      {/* Chats */}
      <section aria-labelledby="space-chats" className="mt-10">
        <h2 id="space-chats" className="text-xl font-semibold">
          Chats
        </h2>
        <div className="mt-3">
          {chats.length === 0 ? (
            <p className="text-muted-foreground">No chats yet. Ask a question above to start one.</p>
          ) : (
            <ul className={listClass}>
              {chats.map((c) => (
                <li key={c.id}>
                  <Link href={`/chat/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-glass-strong">
                    <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{c.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <SpaceDialog open={editing} onOpenChange={setEditing} space={space} />
    </>
  );
}

function DocStatus({ doc }: { doc: DocumentItem }) {
  if (doc.status === "ready") return null;
  if (doc.status === "failed") return <span className="shrink-0 text-sm text-destructive">Couldn&apos;t read</span>;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground" role="status">
      <Loader2Icon className="size-4 animate-spin" />
      Indexing
    </span>
  );
}
