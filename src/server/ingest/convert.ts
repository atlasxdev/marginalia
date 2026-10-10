import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

/* A failure whose message is safe to show the user */
export class IngestError extends Error {}

// convertToMarkdown is in mammoth's runtime but missing from its types
const { convertToMarkdown } = mammoth as unknown as {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

// Every format becomes markdown, so one chunker handles them all.
export async function toMarkdown(bytes: Uint8Array, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop();

  if (ext === "md") return new TextDecoder().decode(bytes);

  if (ext === "pdf") {
    const pdf = await getDocumentProxy(bytes);
    const { text: pages } = await extractText(pdf, { mergePages: false });
    if (!pages.some((p) => p.trim())) {
      throw new IngestError(
        "No text found. This looks like a scanned PDF. Export it with selectable text and try again."
      );
    }
    // PDFs have no reliable headings, so each page becomes a section and sources can say "Page 3"
    return pages.map((text, i) => `# Page ${i + 1}\n\n${text.trim()}`).join("\n\n");
  }

  if (ext === "docx") {
    const { value } = await convertToMarkdown({ buffer: Buffer.from(bytes) });
    // mammoth escapes punctuation (1\. or \(a\)), which would show up in excerpts
    return value.replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1");
  }

  throw new IngestError("Upload a Markdown, PDF, or Word file.");
}
