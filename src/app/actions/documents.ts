"use server";

import { after } from "next/server";
import { z } from "zod";
import { ACCEPTED_TYPES, MAX_FILE_BYTES } from "@/lib/schemas";
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
