import "server-only";
import { MAX_FILE_BYTES } from "@/lib/schemas";
import { documentTitle } from "@/lib/data";
import { admin } from "@/lib/supabase/admin";
import { embed, generateText } from "@/server/gemini";
import { chunkMarkdown } from "./chunk";
import { IngestError, toMarkdown } from "./convert";

const MAX_CHUNKS = 1500;
const INSERT_BATCH = 200;

/* The ingestion pipeline: download the original file, convert it to markdown,
   chunk it, embed the chunks, and store them. Runs after the upload response
   (via after()) with the secret key, so document status is only written here. */
export async function ingestDocument(documentId: string) {
  const { data: doc } = await admin.from("documents").select("*").eq("id", documentId).single();
  if (!doc) return;

  const setStatus = (fields: Record<string, unknown>) =>
    admin
      .from("documents")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", documentId);

  await setStatus({ status: "processing", error: null });

  try {
    const { data: file, error } = await admin.storage.from("documents").download(doc.storage_path);
    if (error || !file) throw new IngestError("The file is missing. Delete it and upload it again.");
    if (file.size > MAX_FILE_BYTES) throw new IngestError("Files must be 10 MB or smaller.");

    const markdown = await toMarkdown(new Uint8Array(await file.arrayBuffer()), doc.filename);
    const chunks = chunkMarkdown(markdown);
    if (chunks.length === 0) throw new IngestError("No text found in this file.");
    if (chunks.length > MAX_CHUNKS) {
      throw new IngestError("This file is too long. Split it into smaller files and upload those.");
    }

    // The title and heading path go into each embedding, so a chunk carries its context
    const title = documentTitle(doc.filename);
    const vectors = await embed(
      chunks.map((c) => [title, c.headingPath, c.content].filter(Boolean).join("\n\n")),
      "RETRIEVAL_DOCUMENT"
    );

    /* Replace chunks from an earlier version or attempt. The new ones go in first,
       so an edited document stays searchable throughout; ids only grow, so
       everything at or below the old maximum is the previous version. */
    const { data: last } = await admin
      .from("chunks")
      .select("id")
      .eq("document_id", documentId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    const previousMaxId = last?.id ?? 0;
    for (let i = 0; i < chunks.length; i += INSERT_BATCH) {
      const rows = chunks.slice(i, i + INSERT_BATCH).map((c, j) => ({
        document_id: documentId,
        user_id: doc.user_id,
        chunk_index: i + j,
        heading_path: c.headingPath,
        content: c.content,
        embedding: JSON.stringify(vectors[i + j]),
      }));
      const { error: insertError } = await admin.from("chunks").insert(rows);
      if (insertError) {
        await admin.from("chunks").delete().eq("document_id", documentId).gt("id", previousMaxId);
        throw insertError;
      }
    }
    await admin.from("chunks").delete().eq("document_id", documentId).lte("id", previousMaxId);

    await setStatus({ status: "ready", chunk_count: chunks.length });
    // Extra: a failure here leaves the document ready, just without suggestions
    const questions = await suggestQuestions(title, markdown).catch(() => []);
    if (questions.length) await setStatus({ suggested_questions: questions });
  } catch (error) {
    console.error(`Ingestion failed for document ${documentId}:`, error);
    await setStatus({
      status: "failed",
      error:
        error instanceof IngestError
          ? error.message
          : "Something went wrong while reading this file. Try again.",
    });
  }
}


const SUGGESTION_SOURCE_CHARS = 8000;

// Three short questions the start of the document clearly answers
async function suggestQuestions(title: string, markdown: string) {
  const text = await generateText(
    `Here is the start of a document titled "${title}".\n\n${markdown.slice(0, SUGGESTION_SOURCE_CHARS)}\n\n` +
      "Write 3 short questions (under 12 words each) a reader could ask that this text clearly answers. " +
      "Each question must make sense on its own, so name the subject instead of writing he, she, it or this. " +
      "Use plain language, as a person would type them. One question per line, with no numbering or quotes."
  );
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^["“]|["”]$/g, "").trim())
    .filter((q) => q.endsWith("?") && q.length <= 120)
    .slice(0, 3);
}
