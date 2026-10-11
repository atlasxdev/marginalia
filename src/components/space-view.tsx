"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileTextIcon, Loader2Icon, MessageSquareIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { deleteSpace, setSpaceDocuments, updateSpace } from "@/app/actions/spaces";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { conversationsQuery, documentsQuery, spaceQuery } from "@/lib/queries";
import { MAX_SPACE_INSTRUCTIONS } from "@/lib/schemas";
import type { DocumentItem, Space } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { KIND } from "./library-view";
import { UploadForm } from "./upload-form";

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

  const [name, setName] = useState(space.name);
  const [instructions, setInstructions] = useState(space.instructions);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (next: { name: string; instructions: string }) => updateSpace({ id: space.id, ...next }),
    onSuccess: (result) => {
      if (result.ok) setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
  const saveError = save.data && !save.data.ok ? (save.data.fieldErrors ? Object.values(save.data.fieldErrors).flat()[0] : save.data.message) : undefined;

  const setDocuments = useMutation({
    mutationFn: (documentIds: string[]) => setSpaceDocuments({ spaceId: space.id, documentIds }),
    onMutate: async (documentIds) => {
      await queryClient.cancelQueries({ queryKey: ["spaces", space.id] });
      const previous = queryClient.getQueryData<Space>(["spaces", space.id]);
      queryClient.setQueryData<Space>(["spaces", space.id], (s) => (s ? { ...s, documentIds } : s));
      return { previous };
    },
    onError: (_e, _ids, ctx) => queryClient.setQueryData(["spaces", space.id], ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["spaces"] }),
  });

  const remove = useMutation({
    mutationFn: () => deleteSpace(space.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["spaces", space.id] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.push("/chat");
    },
  });

  function saveName() {
    const next = name.trim();
    if (!next) return setName(space.name);
    if (next !== space.name) save.mutate({ name: next, instructions: space.instructions });
  }

  const instructionsChanged = instructions.trim() !== space.instructions;

  return (
    <>
      <div className="flex items-start gap-2">
        <input
          aria-label="Space name"
          value={name}
          maxLength={80}
          // A new space opens ready to be named
          autoFocus={space.name === "Untitled space"}
          onFocus={(e) => space.name === "Untitled space" && e.currentTarget.select()}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="min-w-0 flex-1 rounded-lg bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="Name this space"
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Delete space" className="mt-0.5 text-muted-foreground hover:text-destructive">
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
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-3">
          <h2 id="space-documents" className="text-xl font-semibold">
            Documents
          </h2>
          <AddDocuments
            library={documents}
            selected={space.documentIds}
            onSave={(ids) => setDocuments.mutate(ids)}
          />
          <UploadForm spaceId={space.id} />
        </div>
        {setDocuments.data && !setDocuments.data.ok && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {setDocuments.data.message}
          </p>
        )}
        <div className="mt-3">
          {inSpace.length === 0 ? (
            <p className="glass rounded-xl border border-glass-border bg-glass px-4 py-8 text-center text-muted-foreground">
              No documents yet. Add some from your library, or upload new ones.
            </p>
          ) : (
            <ul className={listClass}>
              {inSpace.map((doc) => (
                <li key={doc.id} className="group flex items-center gap-3 px-4 py-3">
                  <KindIcon doc={doc} />
                  <p className="min-w-0 flex-1 truncate font-medium">{doc.filename}</p>
                  <DocStatus doc={doc} />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${doc.filename} from this space`}
                    onClick={() => setDocuments.mutate(space.documentIds.filter((d) => d !== doc.id))}
                    className="-mr-2 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Instructions */}
      <section aria-labelledby="space-instructions" className="mt-10">
        <h2 id="space-instructions" className="text-xl font-semibold">
          Instructions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional. How answers in this space should read. Answers still come only from its documents, with sources.
        </p>
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ name: space.name, instructions });
          }}
        >
          <Textarea
            aria-labelledby="space-instructions"
            value={instructions}
            maxLength={MAX_SPACE_INSTRUCTIONS}
            onChange={(e) => {
              setInstructions(e.target.value);
              setSaved(false);
            }}
            placeholder="For example: Explain things like a patient tutor and end with a quick quiz question."
            className="glass min-h-28 rounded-xl border-glass-border bg-glass px-4 py-3 text-[15px] md:text-[15px] dark:bg-glass"
          />
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {instructions.length} / {MAX_SPACE_INSTRUCTIONS}
            </span>
            <span role="status" className="flex-1 text-right text-sm">
              {saveError ? (
                <span className="text-destructive">{saveError}</span>
              ) : saved && !instructionsChanged ? (
                <span className="text-muted-foreground">Saved</span>
              ) : null}
            </span>
            <Button type="submit" disabled={!instructionsChanged || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </section>

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
    </>
  );
}

function KindIcon({ doc }: { doc: DocumentItem }) {
  const kind = KIND[doc.mimeType] ?? { label: "File", color: "bg-[#8e8e93]" };
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-white", kind.color)}>
      <FileTextIcon className="size-[18px]" />
    </span>
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

// Pick which library documents this space searches
function AddDocuments({
  library,
  selected,
  onSave,
}: {
  library: DocumentItem[];
  selected: string[];
  onSave: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setPicked(new Set(selected));
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="glass">
          <PlusIcon />
          Add from library
        </Button>
      </DialogTrigger>
      <DialogContent className="glass gap-0 border border-glass-border bg-glass-strong p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-glass-divider p-5">
          <DialogTitle>Choose documents</DialogTitle>
          <DialogDescription>This space answers only from the documents you pick.</DialogDescription>
        </DialogHeader>
        {library.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted-foreground">Your library is empty. Upload a file to get started.</p>
        ) : (
          <ul className="max-h-[55vh] divide-y divide-glass-divider overflow-y-auto">
            {library.map((doc) => {
              const id = `pick-${doc.id}`;
              return (
                <li key={doc.id}>
                  <label htmlFor={id} className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-glass">
                    <Checkbox
                      id={id}
                      checked={picked.has(doc.id)}
                      onCheckedChange={(checked) =>
                        setPicked((p) => {
                          const next = new Set(p);
                          if (checked) next.add(doc.id);
                          else next.delete(doc.id);
                          return next;
                        })
                      }
                    />
                    <KindIcon doc={doc} />
                    <span className="min-w-0 flex-1 truncate">{doc.filename}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter className="m-0 flex-row items-center border-glass-divider bg-transparent p-4">
          <span className="mr-auto text-sm text-muted-foreground">{picked.size} selected</span>
          <Button
            onClick={() => {
              onSave([...picked]);
              setOpen(false);
            }}
            disabled={library.length === 0}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
