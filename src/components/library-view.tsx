"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteDocument, retryDocument } from "@/app/actions/documents";
import { documentsQuery } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";
import type { DocumentItem, DocumentStatus } from "@/lib/types";
import { UploadForm } from "./upload-form";

const KIND: Record<string, string> = {
  "text/markdown": "Markdown",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  pending: "Queued",
  processing: "Indexing",
  ready: "Ready",
  failed: "Couldn't read",
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
        <p className="mt-2 text-ink-soft">
          Every file here is converted to text, split into sections, and indexed for search.
        </p>

        <div className="mt-8">
          <UploadForm />
        </div>

        <section aria-labelledby="docs-heading" className="mt-8">
          <h2 id="docs-heading" className="sr-only">
            Documents
          </h2>

          {error && <p className="text-danger">Couldn&apos;t load your documents. Refresh to try again.</p>}

          {isPending && (
            <ul className="divide-y divide-rule border-y border-rule" aria-label="Loading documents">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex animate-pulse items-center gap-4 py-4">
                  <div className="h-4 w-1/2 rounded bg-rule/70" />
                  <div className="ml-auto h-4 w-16 rounded bg-rule/50" />
                </li>
              ))}
            </ul>
          )}

          {documents?.length === 0 && (
            <p className="border-y border-rule py-8 text-center text-ink-soft">
              No documents yet. Upload one above to start asking questions.
            </p>
          )}

          {documents && documents.length > 0 && (
            <ul className="divide-y divide-rule border-y border-rule">
              {documents.map((doc) => (
                <li key={doc.id} className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{doc.filename}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {KIND[doc.mimeType] ?? "File"}, {formatSize(doc.sizeBytes)}, added{" "}
                      {dateFormat.format(new Date(doc.createdAt))}
                      {doc.status === "ready" && `, ${doc.chunkCount} sections`}
                    </p>
                    {doc.error && <p className="mt-1.5 max-w-[60ch] text-sm text-danger">{doc.error}</p>}
                  </div>

                  <div className="flex items-center gap-4">
                    <StatusBadge status={doc.status} />
                    <div className="flex gap-3 text-sm">
                      {doc.status === "failed" && (
                        <button
                          onClick={() => retry.mutate(doc.id)}
                          disabled={retry.isPending && retry.variables === doc.id}
                          className="font-medium text-ink underline-offset-4 hover:underline disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${doc.filename}"? Its sections are removed from search too.`)) {
                            remove.mutate(doc.id);
                          }
                        }}
                        className="text-ink-soft underline-offset-4 hover:text-danger hover:underline"
                        aria-label={`Delete ${doc.filename}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
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
  const busy = status === "pending" || status === "processing";
  const tone =
    status === "ready"
      ? "text-ok"
      : status === "failed"
        ? "text-danger"
        : "text-ink";
  return (
    <span className={`flex items-center gap-1.5 text-sm whitespace-nowrap ${tone}`} role="status">
      <span
        aria-hidden
        className={`size-2 rounded-full bg-current ${busy ? "animate-pulse" : ""} ${
          status === "processing" ? "bg-highlight!" : ""
        }`}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}
