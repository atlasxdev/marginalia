import type { Source } from "./types";

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g, // OpenAI-style keys
  /\bAIza[A-Za-z0-9_-]{35}\b/g, // Google API keys
  /\b\d{12,19}\b/g, // card/account numbers
];

const PROMPT_LEAK_MARKERS = ["## Guard rules", "You are a document assistant"];

export const OUT_OF_SCOPE_REPLY = "I can only answer questions about your uploaded documents.";

export type CitedSource = Source & { index: number };

export function formatResponse(raw: string, sources: Source[], streaming = false) {
  let text = raw.trim();

  // 1. Block replies that leak the system prompt
  if (PROMPT_LEAK_MARKERS.some((m) => text.includes(m))) {
    return { markdown: OUT_OF_SCOPE_REPLY, cited: [] as CitedSource[] };
  }

  // 2. Mask secrets, keeping the last 4 characters
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, (m) => "****" + m.slice(-4));
  }

  // 3. Citations: valid [n] → link, invalid [n] → removed
  const cited = new Set<number>();
  text = text.replace(/\[(\d+)\](?!\()/g, (_, n) => {
    const i = Number(n);
    if (i < 1 || i > sources.length) return "";
    cited.add(i);
    return `[${i}](#cite-${i})`;
  });

  // 4. While streaming, close an unfinished code block so the layout doesn't jump
  if (streaming && (text.match(/```/g)?.length ?? 0) % 2 === 1) {
    text += "\n```";
  }

  return {
    markdown: text,
    cited: [...cited]
      .sort((a, b) => a - b)
      .map((i): CitedSource => ({ index: i, ...sources[i - 1] })),
  };
}
