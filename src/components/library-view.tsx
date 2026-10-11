"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlusIcon, FileTextIcon, Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { deleteDocument, retryDocument } from "@/app/actions/documents";
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
import { documentsQuery } from "@/lib/queries";
import type { DocumentItem } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { UploadForm } from "./upload-form";

export const KIND: Record<string, { label: string; color: string }> = {
  "text/markdown": { label: "Markdown", color: "bg-[#8e8e93]" },
  "application/pdf": { label: "PDF", color: "bg-[#ff3b30]" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { label: "Word", color: "bg-[#007aff]" },
};

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function LibraryView() {
  const queryClient = useQueryClient();
  const query = useQuery(documentsQuery);
  const hydrated = useHydrated();
  const documents = hydrated ? query.data : undefined;
  const isPending = !hydrated || query.isPending;
  const error = hydrated ? query.error : null;

  const retry = useMutation({
    mutationFn: retryDocument,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const remove = useMutation({
    mutationFn: deleteDocument,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["documents"] });
      const previous = queryClient.getQueryData<DocumentItem[]>(["documents"]);
      queryClient.setQueryData<DocumentItem[]>(["documents"], (docs) => docs?.filter((d) => d.id !== id));
      return { previous };
    },
    onError: (_err, _id, ctx) => queryClient.setQueryData(["documents"], ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 pt-10 pb-12 sm:px-6">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Library</h1>
          <Button asChild variant="glass">
            <Link href="/library/new">
              <FilePlusIcon />
              New
            </Link>
          </Button>
          <UploadForm />
        </div>
        <p className="mt-1 text-muted-foreground">
          Markdown, PDF, and Word files. Drop a file anywhere on this page to upload it, or write a new
          one in Markdown.
        </p>

        <section aria-label="Documents" className="mt-6">
          {error && <p className="text-destructive">Couldn&apos;t load your documents. Refresh to try again.</p>}

          {isPending && (
            <ul className="glass border border-glass-border bg-glass divide-y divide-glass-divider overflow-hidden rounded-xl" aria-label="Loading documents">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-9 rounded-lg" />
                  <Skeleton className="h-4 w-1/2" />
                </li>
              ))}
            </ul>
          )}

          {documents?.length === 0 && (
            <p className="glass border border-glass-border bg-glass rounded-xl px-4 py-10 text-center text-muted-foreground">No documents yet</p>
          )}

          {documents && documents.length > 0 && (
            <ul className="glass border border-glass-border bg-glass divide-y divide-glass-divider overflow-hidden rounded-xl">
              {documents.map((doc) => {
                const kind = KIND[doc.mimeType] ?? { label: "File", color: "bg-[#8e8e93]" };
                const editable = doc.mimeType === "text/markdown";
                return (
                  <li key={doc.id} className="group flex items-center gap-3 px-4 py-3">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-white", kind.color)}>
                      <FileTextIcon className="size-[18px]" />
                    </span>

                    <div className="min-w-0 flex-1">
                      {editable ? (
                        <Link href={`/library/${doc.id}`} className="block truncate font-medium hover:underline">
                          {doc.filename}
                        </Link>
                      ) : (
                        <p className="truncate font-medium">{doc.filename}</p>
                      )}
                      <p className="truncate text-sm text-muted-foreground">
                        {doc.error ??
                          `${kind.label}, ${formatSize(doc.sizeBytes)}, ${dateFormat.format(new Date(doc.createdAt))}`}
                      </p>
                    </div>

                    <Status doc={doc} onRetry={() => retry.mutate(doc.id)} retrying={retry.isPending && retry.variables === doc.id} />

                    {editable && (
                      <Button
                        asChild
                        variant="ghost"
                        size="icon-sm"
                        className="-mr-2 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Link href={`/library/${doc.id}`} aria-label={`Edit ${doc.filename}`}>
                          <PencilIcon />
                        </Link>
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${doc.filename}`}
                          className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                        >
                          <Trash2Icon />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass border border-glass-border bg-glass-strong">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete “{doc.filename}”?</AlertDialogTitle>
                          <AlertDialogDescription>
                            It will be removed from your library and from search.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => remove.mutate(doc.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Status({ doc, onRetry, retrying }: { doc: DocumentItem; onRetry: () => void; retrying: boolean }) {
  switch (doc.status) {
    case "ready":
      return <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{doc.chunkCount} sections</span>;
    case "processing":
      return (
        <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground" role="status">
          <Loader2Icon className="size-4 animate-spin" />
          Indexing
        </span>
      );
    case "pending":
      return (
        <span className="shrink-0 text-sm text-muted-foreground" role="status">
          Waiting
        </span>
      );
    case "failed":
      return (
        <span className="flex shrink-0 items-center gap-3 text-sm">
          <span className="text-destructive">Couldn&apos;t read</span>
          <Button variant="link" className="h-auto p-0" disabled={retrying} onClick={onRetry}>
            Retry
          </Button>
        </span>
      );
  }
}
