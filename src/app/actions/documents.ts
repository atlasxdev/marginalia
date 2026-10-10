"use server";

import { z } from "zod";
import { uploadSchema } from "@/lib/schemas";
import type { ActionState } from "@/lib/types";
import * as store from "@/server/mock-store";

export async function uploadDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = uploadSchema.safeParse({ file: formData.get("file") });
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const doc = await store.createDocument(parsed.data.file);
  return { ok: true, message: `Uploaded ${doc.filename}.` };
}

export async function retryDocument(id: string): Promise<ActionState> {
  const doc = await store.retryDocument(z.string().parse(id));
  if (!doc) return { ok: false, message: "That document no longer exists." };
  return { ok: true };
}

export async function deleteDocument(id: string): Promise<ActionState> {
  await store.deleteDocument(z.string().parse(id));
  return { ok: true };
}
