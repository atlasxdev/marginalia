import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { Ink } from "./ink-block";

// Styling has no Markdown form, so the indexed text keeps the words and drops the look
const plain = { renderMarkdown: (node: unknown, h: { renderChildren: (n: never) => string }) => h.renderChildren(node as never) };

export const noteExtensions = [
  StarterKit.configure({
    underline: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } },
  }),
  Underline.extend(plain),
  Highlight.extend(plain).configure({ multicolor: true }),
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: false } }),
  Placeholder.configure({ placeholder: "Start writing, or tap Draw to write by hand." }),
  Markdown,
  Ink,
];
