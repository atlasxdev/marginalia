"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { uploadDocument } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { ACCEPTED_TYPES } from "@/lib/schemas";

const ACCEPT = Object.values(ACCEPTED_TYPES).join(",");

// An Upload button, plus drag-and-drop anywhere on the page.
export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadDocument, { ok: false });
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (state.ok) queryClient.invalidateQueries({ queryKey: ["documents"] });
  }, [state, queryClient]);

  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      const input = inputRef.current;
      if (!file || !input) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      formRef.current?.requestSubmit();
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  const error = state.fieldErrors?.file?.[0];

  return (
    <form ref={formRef} action={formAction} className="contents">
      <input
        ref={inputRef}
        id="file"
        type="file"
        name="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => e.currentTarget.files?.length && formRef.current?.requestSubmit()}
      />
      <Button type="button" disabled={pending} onClick={() => inputRef.current?.click()}>
        <PlusIcon />
        {pending ? "Uploading…" : "Upload"}
      </Button>

      <p role="status" className="col-span-full text-sm empty:hidden">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : state.ok ? (
          <span className="text-muted-foreground">{state.message} It&apos;ll be ready to search in a moment.</span>
        ) : null}
      </p>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary px-10 py-8 text-center">
            <p className="text-lg font-semibold">Drop to upload</p>
            <p className="mt-1 text-sm text-muted-foreground">Markdown, PDF, or Word, up to 10 MB</p>
          </div>
        </div>
      )}
    </form>
  );
}
