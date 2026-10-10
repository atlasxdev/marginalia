/*
 * Markdown formatting for a plain <textarea>. Each command works out the text to
 * replace and where the selection should land, then applies it as typing, so
 * the browser's own undo (Ctrl/⌘ Z) still steps back through it.
 */

type Edit = { from: number; to: number; insert: string; selStart: number; selEnd: number };
type Command = (value: string, start: number, end: number) => Edit;

export type FormatAction =
  | "heading"
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "link"
  | "bullet"
  | "numbered"
  | "task"
  | "quote"
  | "codeBlock"
  | "table"
  | "rule";

// Wraps the selection in a marker, or unwraps it if it's already wrapped.
const wrap =
  (before: string, after: string, placeholder: string): Command =>
  (value, start, end) => {
    const selected = value.slice(start, end);
    const outside = value.slice(start - before.length, start) === before && value.slice(end, end + after.length) === after;
    if (outside) {
      return { from: start - before.length, to: end + after.length, insert: selected, selStart: start - before.length, selEnd: end - before.length };
    }
    const text = selected || placeholder;
    return { from: start, to: end, insert: before + text + after, selStart: start + before.length, selEnd: start + before.length + text.length };
  };

// Adds a prefix to every selected line, or removes it if every line already has it.
const prefixLines =
  (prefix: (i: number) => string, pattern: RegExp): Command =>
  (value, start, end) => {
    const from = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end);
    const to = lineEnd === -1 ? value.length : lineEnd;
    const lines = value.slice(from, to).split("\n");
    const filled = lines.filter((l) => l.trim());
    const allPrefixed = filled.length > 0 && filled.every((l) => pattern.test(l));
    let n = 0;
    const insert = lines
      .map((l) => {
        if (!l.trim() && lines.length > 1) return l; // leave blank lines alone
        // Switching kinds (bullet to numbered, say) replaces the old marker
        return allPrefixed ? l.replace(pattern, "") : prefix(n++) + l.replace(LINE_MARKER, "");
      })
      .join("\n");
    // A single empty line: put the cursor after the new marker
    if (!value.slice(from, to).trim()) return { from, to, insert, selStart: from + insert.length, selEnd: from + insert.length };
    return { from, to, insert, selStart: from, selEnd: from + insert.length };
  };

const LINE_MARKER = /^([-*+] \[[ x]\] |[-*+] |\d+\. |> |#{1,6} )/;

// Inserts a block on its own lines, with blank lines around it.
const block =
  (make: (selected: string) => { text: string; select: [number, number] }): Command =>
  (value, start, end) => {
    const { text, select } = make(value.slice(start, end));
    const lead = start === 0 ? "" : value.slice(0, start).endsWith("\n\n") ? "" : value[start - 1] === "\n" ? "\n" : "\n\n";
    const trail = value.slice(end).startsWith("\n") ? "\n" : "\n\n";
    const insert = lead + text + trail;
    return { from: start, to: end, insert, selStart: start + lead.length + select[0], selEnd: start + lead.length + select[1] };
  };

const TABLE = "| Column | Column |\n| --- | --- |\n| Cell | Cell |";

const COMMANDS: Record<FormatAction, Command> = {
  heading: prefixLines(() => "## ", /^## /),
  bold: wrap("**", "**", "bold text"),
  italic: wrap("_", "_", "italic text"),
  strike: wrap("~~", "~~", "struck text"),
  code: wrap("`", "`", "code"),
  link: (value, start, end) => {
    const text = value.slice(start, end) || "link text";
    const insert = `[${text}](https://)`;
    // Select the URL so it can be typed straight over
    const urlStart = start + text.length + 3;
    return { from: start, to: end, insert, selStart: urlStart, selEnd: urlStart + "https://".length };
  },
  bullet: prefixLines(() => "- ", /^- (?!\[[ x]\] )/),
  numbered: prefixLines((i) => `${i + 1}. `, /^\d+\. /),
  task: prefixLines(() => "- [ ] ", /^- \[[ x]\] /),
  quote: prefixLines(() => "> ", /^> /),
  codeBlock: block((s) => ({ text: "```\n" + (s || "code") + "\n```", select: [4, 4 + (s || "code").length] })),
  table: block(() => ({ text: TABLE, select: [2, 8] })),
  rule: block(() => ({ text: "---", select: [3, 3] })),
};

export function applyFormat(textarea: HTMLTextAreaElement, action: FormatAction) {
  const { value, selectionStart, selectionEnd } = textarea;
  const edit = COMMANDS[action](value, selectionStart, selectionEnd);
  textarea.focus();
  textarea.setSelectionRange(edit.from, edit.to);
  // insertText keeps the undo history; setRangeText is the fallback where it's unsupported
  if (!document.execCommand("insertText", false, edit.insert)) {
    textarea.setRangeText(edit.insert, edit.from, edit.to, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
  textarea.setSelectionRange(edit.selStart, edit.selEnd);
}
