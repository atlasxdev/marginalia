"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UploadIcon } from "lucide-react";
import { uploadDocument } from "@/app/actions/documents";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACCEPTED_TYPES } from "@/lib/schemas";

const ACCEPT = Object.values(ACCEPTED_TYPES).join(",");

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadDocument, { ok: false });
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (state.ok) queryClient.invalidateQueries({ queryKey: ["documents"] });
  }, [state, queryClient]);

  function submitFile(file: File) {
    const input = inputRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    formRef.current?.requestSubmit();
  }

  const error = state.fieldErrors?.file?.[0];

  return (
    <form ref={formRef} action={formAction}>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) submitFile(file);
        }}
        data-dragging={dragging}
        // A tray set into the desk: files get dropped in
        className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl bg-muted px-6 py-9 text-center inset-shadow-recess transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring data-[dragging=true]:bg-highlight-soft"
      >
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept={ACCEPT}
          className="sr-only"
          aria-describedby="upload-help"
          onChange={(e) => e.currentTarget.files?.length && formRef.current?.requestSubmit()}
          disabled={pending}
        />
        <span className={cn(buttonVariants({ variant: "paper" }), "pointer-events-none h-9 gap-2 px-4 text-foreground group-hover:-translate-y-px group-hover:shadow-lift-2")}>
          <UploadIcon />
          {pending ? "Uploading…" : dragging ? "Drop to upload" : "Choose a file or drop it here"}
        </span>
        <span id="upload-help" className="text-sm text-muted-foreground">
          Markdown, PDF, or Word, up to 10 MB. Text only: images and scanned pages are skipped.
        </span>
      </label>
      <p role="status" className="mt-2 min-h-5 text-sm">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : state.ok ? (
          <span className="text-success">{state.message} It&apos;ll be ready to search in a moment.</span>
        ) : null}
      </p>
    </form>
  );
}
