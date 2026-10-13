"use client";

import { Fragment, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  BaselineIcon,
  BoldIcon,
  HighlighterIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  PenLineIcon,
  QuoteIcon,
  Redo2Icon,
  SquareCodeIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FONTS, HIGHLIGHTS, SIZES, TEXT_COLORS } from "@/lib/note";
import { cn } from "@/lib/utils";

// Radix Select can't use "" as a value, so the default option gets a name
const DEFAULT = "default";
const BLOCKS = [
  { name: "Text", value: "p" },
  { name: "Heading 1", value: "1" },
  { name: "Heading 2", value: "2" },
  { name: "Heading 3", value: "3" },
] as const;

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function Tip({ label, keys, children }: { label: string; keys?: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        {label}
        {keys && <span className="ml-1.5 opacity-60">{isMac() ? `⌘${keys}` : `Ctrl+${keys}`}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

const Divider = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-glass-divider" />;

export function NoteToolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const style = e.getAttributes("textStyle");
      const level = [1, 2, 3].find((l) => e.isActive("heading", { level: l }));
      return {
        block: level ? String(level) : "p",
        font: (style.fontFamily as string) || DEFAULT,
        size: (style.fontSize as string) || DEFAULT,
        color: (style.color as string) || "",
        highlight: e.isActive("highlight") ? ((e.getAttributes("highlight").color as string) ?? HIGHLIGHTS[0].value) : "",
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        taskList: e.isActive("taskList"),
        blockquote: e.isActive("blockquote"),
        codeBlock: e.isActive("codeBlock"),
        link: (e.getAttributes("link").href as string) ?? "",
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  const chain = () => editor.chain().focus();
  // After picking from a menu, typing carries on in the note rather than on the menu's button
  const backToText = (e: Event) => {
    e.preventDefault();
    editor.commands.focus();
  };

  const marks: { key: "bold" | "italic" | "underline" | "strike"; label: string; icon: LucideIcon; keys: string; run: () => void }[] = [
    { key: "bold", label: "Bold", icon: BoldIcon, keys: "B", run: () => chain().toggleBold().run() },
    { key: "italic", label: "Italic", icon: ItalicIcon, keys: "I", run: () => chain().toggleItalic().run() },
    { key: "underline", label: "Underline", icon: UnderlineIcon, keys: "U", run: () => chain().toggleUnderline().run() },
    { key: "strike", label: "Strikethrough", icon: StrikethroughIcon, keys: "⇧S", run: () => chain().toggleStrike().run() },
  ];
  const blocks: { key: "bulletList" | "orderedList" | "taskList" | "blockquote" | "codeBlock"; label: string; icon: LucideIcon; run: () => void }[][] = [
    [
      { key: "bulletList", label: "Bulleted list", icon: ListIcon, run: () => chain().toggleBulletList().run() },
      { key: "orderedList", label: "Numbered list", icon: ListOrderedIcon, run: () => chain().toggleOrderedList().run() },
      { key: "taskList", label: "Checklist", icon: ListTodoIcon, run: () => chain().toggleTaskList().run() },
    ],
    [
      { key: "blockquote", label: "Quote", icon: QuoteIcon, run: () => chain().toggleBlockquote().run() },
      { key: "codeBlock", label: "Code block", icon: SquareCodeIcon, run: () => chain().toggleCodeBlock().run() },
    ],
  ];

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div role="toolbar" aria-label="Formatting" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
          <Tip label="Undo" keys="Z">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Undo" disabled={!s.canUndo} onClick={() => chain().undo().run()}>
              <Undo2Icon />
            </Button>
          </Tip>
          <Tip label="Redo" keys="⇧Z">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Redo" disabled={!s.canRedo} onClick={() => chain().redo().run()}>
              <Redo2Icon />
            </Button>
          </Tip>
          <Divider />
  
          <Select
            value={s.block}
            onValueChange={(v) => (v === "p" ? chain().setParagraph().run() : chain().setHeading({ level: Number(v) as 1 | 2 | 3 }).run())}
          >
            <SelectTrigger size="sm" aria-label="Text style" className="w-[7.5rem] shrink-0 border-0 bg-transparent shadow-none dark:bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start" onCloseAutoFocus={backToText}>
              {BLOCKS.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={s.font} onValueChange={(v) => (v === DEFAULT ? chain().unsetFontFamily().run() : chain().setFontFamily(v).run())}>
            <SelectTrigger size="sm" aria-label="Font" className="w-[8.5rem] shrink-0 border-0 bg-transparent shadow-none dark:bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start" onCloseAutoFocus={backToText}>
              {FONTS.map((f) => (
                <SelectItem key={f.name} value={f.value || DEFAULT} style={{ fontFamily: f.value || undefined }}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={s.size} onValueChange={(v) => (v === DEFAULT ? chain().unsetFontSize().run() : chain().setFontSize(v).run())}>
            <SelectTrigger size="sm" aria-label="Size" className="w-[6.25rem] shrink-0 border-0 bg-transparent shadow-none dark:bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start" onCloseAutoFocus={backToText}>
              {SIZES.map((z) => (
                <SelectItem key={z.name} value={z.value || DEFAULT}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Divider />
  
          {marks.map((m) => (
            <Tip key={m.key} label={m.label} keys={m.keys}>
              <Toggle size="sm" aria-label={m.label} pressed={s[m.key]} onPressedChange={m.run}>
                <m.icon />
              </Toggle>
            </Tip>
          ))}
          <Swatches
            label="Text color"
            icon={<BaselineIcon />}
            bar={s.color || "var(--foreground)"}
            colors={TEXT_COLORS}
            value={s.color}
            onPick={(v) => (v ? chain().setColor(v).run() : chain().unsetColor().run())}
            letter
          />
          <Swatches
            label="Highlight"
            icon={<HighlighterIcon />}
            bar={s.highlight || "var(--hl-yellow)"}
            colors={[{ name: "None", value: "" }, ...HIGHLIGHTS]}
            value={s.highlight}
            onPick={(v) => (v ? chain().setHighlight({ color: v }).run() : chain().unsetHighlight().run())}
          />
          <LinkButton editor={editor} href={s.link} />
  
          {blocks.map((group, i) => (
            <Fragment key={i}>
              <Divider />
              {group.map((b) => (
                <Tip key={b.key} label={b.label}>
                  <Toggle size="sm" aria-label={b.label} pressed={s[b.key]} onPressedChange={b.run}>
                    <b.icon />
                  </Toggle>
                </Tip>
              ))}
            </Fragment>
          ))}
          <Tip label="Table">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Table" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
              <TableIcon />
            </Button>
          </Tip>
          <Tip label="Divider">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Divider" onClick={() => chain().setHorizontalRule().run()}>
              <MinusIcon />
            </Button>
          </Tip>
        </div>
        {/* Outside the scrolling tools, so it's always in reach on a phone */}
        <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={() => chain().insertInk().run()}>
          <PenLineIcon />
          Draw
        </Button>
      </div>
    </TooltipProvider>
  );
}

function Swatches({
  label,
  icon,
  bar,
  colors,
  value,
  onPick,
  letter = false,
}: {
  label: string;
  icon: React.ReactNode;
  bar: string;
  colors: { name: string; value: string }[];
  value: string;
  onPick: (v: string) => void;
  letter?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label={label}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={label} className="relative">
            {icon}
            <span aria-hidden className="absolute inset-x-2 bottom-1 h-[3px] rounded-full" style={{ background: bar }} />
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="start" className="w-auto p-2" onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="flex gap-1" role="radiogroup" aria-label={label}>
          {colors.map((c) => (
            <button
              key={c.name}
              type="button"
              role="radio"
              aria-checked={value === c.value}
              aria-label={c.name}
              title={c.name}
              onClick={() => {
                onPick(c.value);
                setOpen(false);
              }}
              className={cn(
                "grid size-8 place-items-center rounded-lg text-sm font-semibold transition-colors hover:bg-muted",
                value === c.value && "ring-2 ring-ring/60"
              )}
            >
              {letter ? (
                <span style={{ color: c.value || undefined }}>A</span>
              ) : c.value ? (
                <span className="size-5 rounded-md ring-1 ring-foreground/10" style={{ background: c.value }} />
              ) : (
                <span className="size-5 rounded-md ring-1 ring-foreground/20 [background:linear-gradient(to_top_right,transparent_45%,var(--destructive)_45%,var(--destructive)_55%,transparent_55%)]" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LinkButton({ editor, href }: { editor: Editor; href: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const apply = () => {
    const chain = editor.chain().focus().extendMarkRange("link");
    if (url.trim()) chain.setLink({ href: url.trim() }).run();
    else chain.unsetLink().run();
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setUrl(href);
      }}
    >
      <Tip label="Link">
        <PopoverTrigger asChild>
          <Toggle size="sm" aria-label="Link" pressed={!!href} onPressedChange={() => setOpen(true)}>
            <LinkIcon />
          </Toggle>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="start" className="w-80 p-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <Input autoFocus placeholder="Paste a link" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link address" />
          <Button type="submit" size="sm" className="h-8">
            {url.trim() || !href ? "Add" : "Remove"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
