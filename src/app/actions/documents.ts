"use server";

import { after } from "next/server";
import { z } from "zod";
import { ACCEPTED_TYPES, MAX_FILE_BYTES, noteSchema } from "@/lib/schemas";
import { admin } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { ingestDocument } from "@/server/ingest";

const MIME_BY_EXTENSION = Object.fromEntries(
  Object.entries(ACCEPTED_TYPES).map(([mime, ext]) => [ext, mime])
) as Record<string, string>;

// The browser has already uploaded the file to Storage; this records it and starts ingestion.
const registerSchema = z.object({
  id: z.uuid(),
  filename: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
  storagePath: z.string().min(1),
});

export async function registerDocument(input: z.input<typeof registerSchema>): Promise<ActionState> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That upload didn't look right. Try again." };
  const { id, filename, sizeBytes, storagePath } = parsed.data;

  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const mimeType = MIME_BY_EXTENSION[ext];
  if (!mimeType) return { ok: false, message: "Upload a Markdown, PDF, or Word file." };

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  // The path must be inside the user's own folder, under this document's id
  if (!userId || !storagePath.startsWith(`${userId}/${id}/`)) {
    return { ok: false, message: "Sign in again to upload." };
  }

  const { error } = await supabase.from("documents").insert({
    id,
    filename,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    storage_path: storagePath,
  });
  if (error) return { ok: false, message: "Couldn't save that file. Try again." };

  after(() => ingestDocument(id));
  return { ok: true, message: `Uploaded ${filename}.` };
}

export type SaveState = ActionState & { id?: string };

/* Saves a Markdown document from the editor: a new one is created in the user's
   folder, an existing one has its file overwritten. Either way it's re-indexed;
   the old chunks stay searchable until the new ones replace them. */
export async function saveDocument(input: z.input<typeof noteSchema>): Promise<SaveState> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { id, title, content } = parsed.data;
  const filename = `${title}.md`;
  const file = new Blob([content], { type: "text/markdown" });

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return { ok: false, message: "Sign in again to save." };

  if (!id) {
    const newId = crypto.randomUUID();
    const storagePath = `${userId}/${newId}/${filename.replace(/[^\w.\- ()]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file);
    if (uploadError) return { ok: false, message: "Couldn't save. Try again." };
    const { error } = await supabase.from("documents").insert({
      id: newId,
      filename,
      mime_type: "text/markdown",
      size_bytes: file.size,
      storage_path: storagePath,
    });
    if (error) {
      await supabase.storage.from("documents").remove([storagePath]);
      return { ok: false, message: "Couldn't save. Try again." };
    }
    after(() => ingestDocument(newId));
    return { ok: true, id: newId, message: "Saved." };
  }

  // Reading through RLS confirms the document belongs to this user
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path, mime_type, status, error")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return { ok: false, message: "This document no longer exists." };
  if (doc.mime_type !== "text/markdown") return { ok: false, message: "Only Markdown documents can be edited." };

  // Users can't update rows or overwrite files under RLS, so the writes use the secret key.
  // Claiming the row first means two saves can't index the same document at once.
  const { data: claimed } = await admin
    .from("documents")
    .update({ status: "pending", error: null })
    .eq("id", id)
    .in("status", ["ready", "failed"])
    .select("id");
  if (!claimed?.length) return { ok: false, message: "Wait for indexing to finish, then save again." };

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(doc.storage_path, file, { upsert: true, contentType: "text/markdown" });
  if (uploadError) {
    await admin.from("documents").update({ status: doc.status, error: doc.error }).eq("id", id);
    return { ok: false, message: "Couldn't save. Try again." };
  }

  await admin
    .from("documents")
    .update({ filename, size_bytes: file.size, updated_at: new Date().toISOString() })
    .eq("id", id);
  after(() => ingestDocument(id));
  return { ok: true, id, message: "Saved." };
}

export async function retryDocument(id: string): Promise<ActionState> {
  const supabase = await createClient();
  // Reading through RLS confirms the document belongs to this user
  const { data } = await supabase.from("documents").select("id").eq("id", z.uuid().parse(id)).maybeSingle();
  if (!data) return { ok: false, message: "That document no longer exists." };

  await admin.from("documents").update({ status: "pending", error: null }).eq("id", id);
  after(() => ingestDocument(id));
  return { ok: true };
}

export async function deleteDocument(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .delete()
    .eq("id", z.uuid().parse(id))
    .select("storage_path")
    .maybeSingle();
  // Chunks go with the row (on delete cascade); the original file is removed from Storage
  if (data) await supabase.storage.from("documents").remove([data.storage_path]);
  return { ok: true };
}
