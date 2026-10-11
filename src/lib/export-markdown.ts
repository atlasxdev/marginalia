import { formatResponse } from "@/lib/format-response";
import type { Message, Source } from "@/lib/types";

// An answer as plain Markdown: citations become [n], with its sources listed underneath
export function answerToMarkdown(content: string, sources: Source[]) {
  const { markdown, cited } = formatResponse(content, sources);
  const body = markdown.replace(/\[(\d+)\]\(#cite-\d+\)/g, "[$1]");
  if (cited.length === 0) return body;
  // Heading paths usually start with the document's own title, so it isn't repeated
  const list = cited.map((s) => {
    const path = s.headingPath.startsWith(s.documentTitle) ? s.headingPath : [s.documentTitle, s.headingPath].filter(Boolean).join(" › ");
    return `${s.index}. ${path || s.documentTitle}`;
  });
  return `${body}\n\nSources:\n${list.join("\n")}`;
}

export function conversationToMarkdown(title: string, messages: Message[]) {
  const parts = messages.map((m) =>
    m.role === "user" ? `## ${m.content.trim()}` : answerToMarkdown(m.content, m.sources)
  );
  return `# ${title}\n\n${parts.join("\n\n")}\n`;
}

// Saves text as a file through the browser
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}
