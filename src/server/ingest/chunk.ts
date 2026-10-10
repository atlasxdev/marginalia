export type Chunk = { headingPath: string; content: string };

const TARGET = 1200; // characters per chunk, about 300 tokens
const MAX = 1800;
const OVERLAP = 200;

/* Splits markdown into sections by heading, then packs each section's
   paragraphs into chunks of about TARGET characters. Every chunk keeps its
   heading path ("Time off › Annual leave") for context and for citations. */
export function chunkMarkdown(markdown: string): Chunk[] {
  const sections: { path: string[]; lines: string[] }[] = [];
  const headings: string[] = [];
  let current = { path: [] as string[], lines: [] as string[] };
  let inFence = false;

  for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (line.trim().startsWith("```")) inFence = !inFence;
    const heading = inFence ? null : line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      sections.push(current);
      const level = heading[1].length;
      headings.length = level - 1;
      headings[level - 1] = heading[2].replace(/[*_`]/g, "").trim();
      current = { path: headings.filter(Boolean), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);

  const chunks: Chunk[] = [];
  for (const section of sections) {
    const headingPath = section.path.join(" › ");
    for (const content of pack(blocksOf(section.lines.join("\n")))) {
      chunks.push({ headingPath, content });
    }
  }
  return chunks;
}

// Paragraphs, lists and code blocks, separated by blank lines. Oversized blocks are split.
function blocksOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => /\w/.test(b))
    .flatMap((b) => (b.length > MAX ? splitLong(b) : [b]));
}

function splitLong(block: string): string[] {
  const parts: string[] = [];
  let rest = block;
  while (rest.length > MAX) {
    // Prefer a sentence or line end before the limit, then a space
    const window = rest.slice(0, MAX);
    const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"));
    const space = window.lastIndexOf(" ");
    const at = sentence > TARGET / 2 ? sentence + 1 : space > 0 ? space : MAX;
    parts.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

// Packs blocks into chunks, starting each new chunk with the end of the previous one
function pack(blocks: string[]): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const block of blocks) {
    if (current && current.length + block.length + 2 > TARGET) {
      chunks.push(current);
      current = tail(current) + "\n\n" + block;
    } else {
      current = current ? current + "\n\n" + block : block;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function tail(text: string) {
  if (text.length <= OVERLAP) return text;
  const start = text.indexOf(" ", text.length - OVERLAP);
  return "…" + text.slice(start === -1 ? text.length - OVERLAP : start + 1);
}
