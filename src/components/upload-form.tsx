"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { registerDocument } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { ACCEPTED_TYPES, uploadSchema } from "@/lib/schemas";
import { getBrowserClient } from "@/lib/supabase/client";

const ACCEPT = Object.values(ACCEPTED_TYPES).join(",");

/* The file goes straight from the browser to Supabase Storage, so it never hits
   the server's request size limit. The server action then records it and starts
   ingestion. */
async function upload(file: File, spaceId?: string) {
  const parsed = uploadSchema.safeParse({ file });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const supabase = getBrowserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sign in again to upload.");

  const id = crypto.randomUUID();
  // Storage keys reject some characters; the original name is kept in the database
  const safeName = file.name.replace(/[^\w.\- ()]/g, "_");
  const storagePath = `${data.user.id}/${id}/${safeName}`;
  const { error } = await supabase.storage.from("documents").upload(storagePath, file);
  if (error) throw new Error("Couldn't upload that file. Try again.");

  const result = await registerDocument({ id, filename: file.name, sizeBytes: file.size, storagePath, spaceId });
  if (!result.ok) throw new Error(result.message);
  return result.message;
}

// An Upload button, plus drag-and-drop anywhere on the page. With `spaceId`, uploads also join that space.
export function UploadForm({ spaceId }: { spaceId?: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const mutation = useMutation({
    mutationFn: (file: File) => upload(file, spaceId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (spaceId) queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
  });
  const { mutate } = mutation;

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
      if (file) mutate(file);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [mutate]);

  return (
    <>
      <input
        ref={inputRef}
        id="file"
        type="file"
        name="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) mutate(file);
          e.currentTarget.value = "";
        }}
      />
      <Button type="button" disabled={mutation.isPending} onClick={() => inputRef.current?.click()}>
        <PlusIcon />
        {mutation.isPending ? "Uploading…" : "Upload"}
      </Button>

      <p role="status" className="col-span-full text-sm empty:hidden">
        {mutation.isError ? (
          <span className="text-destructive">{mutation.error.message}</span>
        ) : mutation.isSuccess ? (
          <span className="text-muted-foreground">{mutation.data} It&apos;ll be ready to search in a moment.</span>
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
    </>
  );
}
