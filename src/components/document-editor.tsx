"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, Loader2Icon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { z } from "zod";
import { saveDocument, type SaveState } from "@/app/actions/documents";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { documentQuery, documentsQuery } from "@/lib/queries";
import { MAX_NOTE_CHARS, noteSchema } from "@/lib/schemas";
import type { DocumentItem, EditableDocument } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";

type Draft = { id?: string; title: string; content: string };

function PreviewLink({ href, children }: React.ComponentProps<"a">) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
      {children}
    </a>
  );
}
const components = { a: PreviewLink };

// Writes a new Markdown document (no id) or edits an existing one.
export function DocumentEditor({ id }: { id?: string }) {
  const query = useQuery({ ...documentQuery(id ?? ""), enabled: !!id });
  const hydrated = useHydrated();

  if (!id) return <EditorForm initial={{ title: "", content: "" }} />;
  if (!hydrated || query.isPending) return <EditorSkeleton />;
  if (query.error) {
    return <Unavailable title="This document can't be edited" detail="Only Markdown documents can be edited here, and it may have been deleted." />;
  }
  if (query.data.content.length > MAX_NOTE_CHARS) {
    return <Unavailable title="This document is too long to edit here" detail="Edit it on your computer and upload it again." />;
  }
  return <EditorForm key={id} initial={query.data} />;
}

function EditorForm({ initial }: { initial: Draft }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [saved, setSaved] = useState(initial);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const dirty = title !== saved.title || content !== saved.content;

  // Status comes from the library list, which polls while the document is indexing
  const documents = useQuery(documentsQuery).data;
  const doc = initial.id ? documents?.find((d) => d.id === initial.id) : undefined;
  const indexing = doc?.status === "pending" || doc?.status === "processing";

  const save = useMutation({
    // Validates here first so field errors show without a round trip
    mutationFn: async (): Promise<SaveState> => {
      const input = { id: initial.id, title, content };
      const parsed = noteSchema.safeParse(input);
      if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
      return saveDocument(input);
    },
    onSuccess: (result) => {
      if (!result.ok || !result.id) return;
      setSaved({ id: result.id, title, content });
      queryClient.setQueryData<EditableDocument>(["document", result.id], { id: result.id, title, content });
      // Mark it pending right away so the status doesn't read "ready" until the refetch lands
      queryClient.setQueryData<DocumentItem[]>(["documents"], (docs) =>
        docs?.map((d) => (d.id === result.id ? { ...d, status: "pending", error: null } : d))
      );
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (!initial.id) router.replace(`/library/${result.id}`);
    },
  });
  const failed = save.data && !save.data.ok ? save.data : undefined;
  const canSave = dirty && !save.isPending && !indexing;

  const edit = (apply: () => void) => {
    apply();
    if (failed) save.reset();
  };

  /* Next keeps a page mounted but hidden after navigating away, so drop unsaved
     edits on the way out: a new document starts blank next time, an existing one
     shows its last saved text. */
  const resetDraft = useEffectEvent(() => {
    const base = initial.id ? saved : initial;
    setTitle(base.title);
    setContent(base.content);
    setSaved(base);
    setConfirmLeave(false);
    save.reset();
  });
  useEffect(() => () => resetDraft(), []);

  // ⌘S / Ctrl+S saves
  const saveShortcut = useEffectEvent(() => {
    if (canSave) save.mutate();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveShortcut();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  let status: React.ReactNode = null;
  if (save.isPending) status = "Saving…";
  else if (failed?.message) status = <span className="text-destructive">{failed.message}</span>;
  else if (save.isError) status = <span className="text-destructive">Couldn&apos;t save. Try again.</span>;
  else if (dirty) status = "Unsaved changes";
  else if (indexing) {
    status = (
      <span className="flex items-center gap-1.5">
        <Loader2Icon className="size-4 animate-spin" />
        Indexing
      </span>
    );
  } else if (doc?.status === "failed") status = <span className="text-destructive">{doc.error}</span>;
  else if (save.isSuccess && doc?.status === "ready") status = "Saved and ready to search";

  const titleError = failed?.fieldErrors?.title?.[0];
  const contentError = failed?.fieldErrors?.content?.[0];

  return (
    <div className="h-full">
      <div className="mx-auto flex h-full max-w-3xl flex-col px-4 pt-6 pb-4 sm:px-6 sm:pb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2.5 text-primary hover:text-primary"
            onClick={() => (dirty ? setConfirmLeave(true) : router.push("/library"))}
          >
            <ChevronLeftIcon />
            Library
          </Button>
          <p role="status" className="ml-auto truncate text-sm text-muted-foreground">
            {status}
          </p>
          <Button className="shrink-0" disabled={!canSave} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>

        <input
          aria-label="Title"
          placeholder="Untitled"
          value={title}
          onChange={(e) => edit(() => setTitle(e.target.value))}
          aria-invalid={!!titleError}
          aria-describedby={titleError ? "title-error" : undefined}
          autoFocus={!initial.id}
          className="mt-5 w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50"
        />
        {titleError && (
          <p id="title-error" className="mt-1 text-[13px] text-destructive">
            {titleError}
          </p>
        )}

        <Tabs defaultValue="edit" className="mt-4 min-h-0 flex-1 gap-3">
          <div className="flex items-center gap-3">
            <TabsList className="glass border border-glass-border bg-glass">
              <TabsTrigger value="edit" className="px-3">Edit</TabsTrigger>
              <TabsTrigger value="preview" className="px-3">Preview</TabsTrigger>
            </TabsList>
            {contentError && <p className="text-[13px] text-destructive">{contentError}</p>}
          </div>

          <TabsContent value="edit" className="flex min-h-0">
            <textarea
              aria-label="Document text, in Markdown"
              placeholder={"# Heading\n\nWrite in Markdown. Headings help answers point to the right section."}
              value={content}
              onChange={(e) => edit(() => setContent(e.target.value))}
              aria-invalid={!!contentError}
              spellCheck
              className="glass min-h-0 w-full flex-1 resize-none rounded-xl border border-glass-border bg-glass p-5 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </TabsContent>

          <TabsContent
            value="preview"
            className="glass min-h-0 overflow-y-auto rounded-xl border border-glass-border bg-glass p-6"
          >
            {content.trim() ? (
              <div className="answer">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-muted-foreground">Nothing to preview yet.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent className="glass border border-glass-border bg-glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>Your edits since the last save will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => router.push("/library")}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4 pt-6 pb-6 sm:px-6" aria-label="Loading document">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="mt-6 h-9 w-2/3" />
      <Skeleton className="mt-6 min-h-0 flex-1 rounded-xl" />
    </div>
  );
}

function Unavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{detail}</p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/library">Back to Library</Link>
      </Button>
    </div>
  );
}
