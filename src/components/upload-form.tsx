"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadDocument } from "@/app/actions/documents";
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
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-ink-soft/50 px-6 py-10 text-center transition-colors hover:border-ink hover:bg-sheet data-[dragging=true]:border-pen data-[dragging=true]:bg-sheet has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-pen"
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
        <span className="font-medium">
          {pending ? "Uploading…" : dragging ? "Drop to upload" : "Drop a file here or choose one"}
        </span>
        <span id="upload-help" className="mt-1 text-sm text-ink-soft">
          Markdown, PDF, or Word, up to 10 MB. Text only: images and scanned pages are skipped.
        </span>
      </label>
      <p role="status" className="mt-2 min-h-5 text-sm">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : state.ok ? (
          <span className="text-ok">{state.message} It&apos;ll be ready to search in a moment.</span>
        ) : null}
      </p>
    </form>
  );
}
