"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { documentsQuery } from "@/lib/queries";
import type { DocumentItem, DocumentStatus } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { UploadForm } from "./upload-form";

const KIND: Record<string, string> = {
  "text/markdown": "Markdown",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
};

function formatSize(bytes: number) {
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
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8 lg:py-14">
        <h1 className="font-serif text-3xl">Library</h1>
        <p className="mt-2 text-muted-foreground">
          Every file here is converted to text, split into sections, and indexed for search.
        </p>

        <div className="mt-8">
          <UploadForm />
        </div>

        <section aria-labelledby="docs-heading" className="mt-6">
          <h2 id="docs-heading" className="sr-only">
            Documents
          </h2>

          {error && (
            <p className="text-destructive">Couldn&apos;t load your documents. Refresh to try again.</p>
          )}

          {isPending && (
            <ul className="grid gap-3" aria-label="Loading documents">
              {[0, 1, 2].map((i) => (
                <li key={i}>
                  <Card className="flex-row items-center px-5 py-5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="ml-auto h-4 w-16" />
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {documents?.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              No documents yet. Upload one above to start asking questions.
            </p>
          )}

          {documents && documents.length > 0 && (
            <ul className="grid gap-3">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <Card
                    className={cn(
                      "relative grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 px-5 py-4",
                      doc.status === "failed" && "-rotate-[0.3deg]"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium">{doc.filename}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {KIND[doc.mimeType] ?? "File"}, {formatSize(doc.sizeBytes)}, added{" "}
                        {dateFormat.format(new Date(doc.createdAt))}
                        {doc.status === "ready" && `, ${doc.chunkCount} sections`}
                      </p>
                      {doc.error && <p className="mt-1.5 max-w-[60ch] text-sm text-destructive">{doc.error}</p>}
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={doc.status} />
                      <div className="flex gap-1">
                        {doc.status === "failed" && (
                          <Button
                            variant="paper"
                            size="sm"
                            onClick={() => retry.mutate(doc.id)}
                            disabled={retry.isPending && retry.variables === doc.id}
                          >
                            Retry
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${doc.filename}`}
                            >
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="shadow-lift-3">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {doc.filename}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                It&apos;s removed from your library and from search. Past answers that cited it
                                keep their text.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep it</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => remove.mutate(doc.id)}>
                                Delete document
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {(doc.status === "pending" || doc.status === "processing") && (
                      <IndexingStrip slow={doc.status === "pending"} />
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  switch (status) {
    case "ready":
      return <Badge variant="success">Ready</Badge>;
    case "failed":
      return <Badge variant="stamp">Couldn&apos;t read</Badge>;
    case "processing":
      return <Badge variant="pending">Indexing</Badge>;
    case "pending":
      return <Badge variant="outline">Queued</Badge>;
  }
}

// Progress along the card's bottom edge while the file is queued or indexing
function IndexingStrip({ slow }: { slow: boolean }) {
  return (
    <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-highlight/30">
      <div
        className={cn("h-full w-2/5 animate-sweep bg-highlight", slow && "opacity-60 [animation-duration:2.4s]")}
      />
    </div>
  );
}
