"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { ChevronLeftIcon, Loader2Icon } from "lucide-react";
import { z } from "zod";
import { saveDocument, transcribeInk, type SaveState } from "@/app/actions/documents";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { inkSignature, INK_WIDTH, type Stroke } from "@/lib/note";
import { documentQuery, documentsQuery } from "@/lib/queries";
import { MAX_NOTE_CHARS, noteSchema } from "@/lib/schemas";
import type { DocumentItem, EditableDocument } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { noteExtensions } from "./note-editor/extensions";
import { strokePath } from "./note-editor/ink-block";
import { NoteToolbar } from "./note-editor/note-toolbar";

type Draft = { id?: string; title: string; content: string; note?: EditableDocument["note"] };

// Writes a new note (no id) or edits an existing one.
export function DocumentEditor({ id }: { id?: string }) {
  const query = useQuery({ ...documentQuery(id ?? ""), enabled: !!id });
  const hydrated = useHydrated();

  if (!hydrated) return <EditorSkeleton />;
  if (!id) return <EditorForm initial={{ title: "", content: "" }} />;
  if (query.isPending) return <EditorSkeleton />;
  if (query.error) {
    return <Unavailable title="This document can't be edited" detail="Only notes and Markdown documents can be edited here, and it may have been deleted." />;
  }
  if (query.data.content.length > MAX_NOTE_CHARS) {
    return <Unavailable title="This document is too long to edit here" detail="Edit it on your computer and upload it again." />;
  }
  return <EditorForm key={id} initial={query.data} />;
}

/* ---------- handwriting to text ---------- */

// Draws one block's strokes in dark ink on white, for the model to read
async function inkPng(strokes: Stroke[], height: number) {
  const scale = 1.25;
  const canvas = document.createElement("canvas");
  canvas.width = INK_WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  for (const s of strokes) {
    ctx.fillStyle = s.tool === "marker" ? "rgba(255, 220, 0, 0.35)" : "#111";
    ctx.fill(new Path2D(strokePath(s)));
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return "";
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* Reads the handwriting blocks drawn or changed since they were last read, and
   stores the text on each block. A block that can't be read keeps its old text. */
async function transcribeChanged(editor: Editor) {
  const todo = new Map<string, { strokes: Stroke[]; height: number }>();
  editor.state.doc.descendants((n) => {
    if (n.type.name !== "ink") return;
    const sig = inkSignature(n.attrs.strokes);
    if (sig !== n.attrs.textFor) todo.set(sig, { strokes: n.attrs.strokes, height: n.attrs.height });
  });
  if (!todo.size) return;

  const read = new Map<string, string>([["", ""]]);
  await Promise.all(
    [...todo].map(async ([sig, ink]) => {
      if (!sig) return;
      const png = await inkPng(ink.strokes, ink.height);
      const res = png ? await transcribeInk(png) : { ok: false as const };
      if (res.ok) read.set(sig, res.text);
    })
  );

  // The note may have changed while reading, so match blocks by their strokes, not their place
  const tr = editor.state.tr;
  editor.state.doc.descendants((n: PMNode, pos: number) => {
    if (n.type.name !== "ink") return;
    const sig = inkSignature(n.attrs.strokes);
    if (sig !== n.attrs.textFor && read.has(sig)) tr.setNodeMarkup(pos, undefined, { ...n.attrs, text: read.get(sig), textFor: sig });
  });
  if (tr.docChanged) editor.view.dispatch(tr.setMeta("addToHistory", false));
}

/* ---------- the editor ---------- */

function EditorForm({ initial }: { initial: Draft }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initial.title);
  const [savedTitle, setSavedTitle] = useState(initial.title);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [reading, setReading] = useState(false);
  // What the editor resets to: the last saved note
  const [savedNote, setSavedNote] = useState<JSONContent | string>(initial.note ?? initial.content);
  const [savedDoc, setSavedDoc] = useState<PMNode | null>(null);

  const editor = useEditor({
    extensions: noteExtensions,
    content: savedNote,
    contentType: typeof savedNote === "string" ? "markdown" : "json",
    immediatelyRender: false,
    editorProps: { attributes: { class: "note answer doc", "aria-label": "Note", spellcheck: "true" } },
    onCreate: ({ editor: e }) => {
      setSavedDoc(e.state.doc);
    },
  });

  const docChanged = useEditorState({
    editor,
    selector: ({ editor: e }) => !!e && !!savedDoc && !e.state.doc.eq(savedDoc),
  });
  const dirty = title !== savedTitle || !!docChanged;

  // Status comes from the library list, which polls while the document is indexing
  const documents = useQuery(documentsQuery).data;
  const doc = initial.id ? documents?.find((d) => d.id === initial.id) : undefined;
  const indexing = doc?.status === "pending" || doc?.status === "processing";

  const save = useMutation({
    mutationFn: async (): Promise<SaveState & { note?: JSONContent; content?: string }> => {
      if (!editor) return { ok: false };
      setReading(true);
      try {
        await transcribeChanged(editor);
      } finally {
        setReading(false);
      }
      const note = editor.getJSON();
      // Empty paragraphs come out as &nbsp; lines, which mean nothing to search
      const content = editor
        .getMarkdown()
        .split("\n")
        .filter((line) => line.trim() !== "&nbsp;")
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      const input = { id: initial.id, title, content, note: JSON.stringify(note) };
      // Validates here first so field errors show without a round trip
      const parsed = noteSchema.safeParse(input);
      if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
      return { ...(await saveDocument(input)), note, content };
    },
    onSuccess: (result) => {
      if (!result.ok || !result.id || !editor) return;
      setSavedNote(result.note!);
      setSavedDoc(editor.state.doc);
      setSavedTitle(title);
      queryClient.setQueryData<EditableDocument>(["document", result.id], { id: result.id, title, content: result.content!, note: result.note });
      // Mark it pending right away so the status doesn't read "ready" until the refetch lands
      queryClient.setQueryData<DocumentItem[]>(["documents"], (docs) =>
        docs?.map((d) => (d.id === result.id ? { ...d, status: "pending", error: null } : d))
      );
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (!initial.id) router.replace(`/library/${result.id}`);
    },
  });
  const failed = save.data && !save.data.ok ? save.data : undefined;
  const canSave = dirty && !save.isPending && !indexing && !!editor;

  // Clear a failed save's message as soon as the note changes
  const clearFailure = useEffectEvent(() => {
    if (failed) save.reset();
  });
  useEffect(() => {
    if (!editor) return;
    const clear = () => clearFailure();
    editor.on("update", clear);
    return () => {
      editor.off("update", clear);
    };
  }, [editor]);

  /* Next keeps a page mounted but hidden after navigating away, so drop unsaved
     edits on the way out: a new note starts blank next time, an existing one
     shows its last saved version. */
  const resetDraft = useEffectEvent(() => {
    const base = initial.id ? savedTitle : initial.title;
    setTitle(base);
    setSavedTitle(base);
    if (editor && !editor.isDestroyed) {
      const content = initial.id ? savedNote : "";
      editor.commands.setContent(content, { emitUpdate: false, contentType: typeof content === "string" ? "markdown" : "json" });
      setSavedDoc(editor.state.doc);
    }
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
  if (reading) status = "Reading your handwriting…";
  else if (save.isPending) status = "Saving…";
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
  const contentError = failed?.fieldErrors?.content?.[0] ?? failed?.fieldErrors?.note?.[0];

  return (
    <div className="h-full">
      <div className="mx-auto flex h-full max-w-[100rem] flex-col px-5 pt-8 pb-6 sm:px-8 sm:pb-8 lg:px-12">
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

        <Input
          aria-label="Title"
          placeholder="Untitled"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (failed) save.reset();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              editor?.commands.focus("start");
            }
          }}
          aria-invalid={!!titleError}
          aria-describedby={titleError ? "title-error" : undefined}
          autoFocus={!initial.id}
          className="mt-8 h-auto rounded-none border-0 bg-transparent px-0 text-3xl font-bold tracking-tight shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0 md:text-3xl dark:bg-transparent"
        />
        {titleError && (
          <p id="title-error" className="mt-1 text-[13px] text-destructive">
            {titleError}
          </p>
        )}
        {contentError && <p className="mt-1 text-[13px] text-destructive">{contentError}</p>}

        <div className="glass mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-glass-border bg-glass has-[.ProseMirror-focused]:border-ring has-[.ProseMirror-focused]:ring-3 has-[.ProseMirror-focused]:ring-ring/30">
          <div className="flex items-center border-b border-glass-divider px-2 py-1.5">
            {editor ? <NoteToolbar editor={editor} /> : <div className="h-8" />}
          </div>
          <div className="min-h-0 flex-1 cursor-text overflow-y-auto" onClick={(e) => e.target === e.currentTarget && editor?.commands.focus("end")}>
            <EditorContent editor={editor} className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-10" />
          </div>
        </div>
      </div>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent className="border border-glass-border bg-popover">
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
    <div className="mx-auto flex h-full max-w-[100rem] flex-col px-5 pt-8 pb-8 sm:px-8 lg:px-12" aria-label="Loading document">
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
