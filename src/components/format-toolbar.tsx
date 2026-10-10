"use client";

import { Fragment } from "react";
import {
  BoldIcon,
  CodeIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  QuoteIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  TableIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { applyFormat, type FormatAction } from "@/lib/markdown-edit";

type Tool = { action: FormatAction; label: string; icon: LucideIcon; keys?: string };

const GROUPS: Tool[][] = [
  [
    { action: "heading", label: "Heading", icon: HeadingIcon },
    { action: "bold", label: "Bold", icon: BoldIcon, keys: "B" },
    { action: "italic", label: "Italic", icon: ItalicIcon, keys: "I" },
    { action: "strike", label: "Strikethrough", icon: StrikethroughIcon },
  ],
  [
    { action: "link", label: "Link", icon: LinkIcon, keys: "K" },
    { action: "code", label: "Inline code", icon: CodeIcon },
  ],
  [
    { action: "bullet", label: "Bulleted list", icon: ListIcon },
    { action: "numbered", label: "Numbered list", icon: ListOrderedIcon },
    { action: "task", label: "Checklist", icon: ListTodoIcon },
    { action: "quote", label: "Quote", icon: QuoteIcon },
  ],
  [
    { action: "codeBlock", label: "Code block", icon: SquareCodeIcon },
    { action: "table", label: "Table", icon: TableIcon },
    { action: "rule", label: "Divider", icon: MinusIcon },
  ],
];

// Ctrl/⌘ + key in the editor
export const SHORTCUTS: Record<string, FormatAction> = Object.fromEntries(
  GROUPS.flat().flatMap((t) => (t.keys ? [[t.keys.toLowerCase(), t.action]] : []))
);

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function FormatToolbar({
  textareaRef,
  disabled,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={400}>
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]"
      >
        {GROUPS.map((group, i) => (
          <Fragment key={i}>
            {i > 0 && <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-glass-divider" />}
            {group.map((tool) => (
              <Tooltip key={tool.action}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tool.label}
                    disabled={disabled}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    // Keep the text selection: the click shouldn't move focus off the editor
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => textareaRef.current && applyFormat(textareaRef.current, tool.action)}
                  >
                    <tool.icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  {tool.label}
                  {tool.keys && (
                    <span className="opacity-60">
                      {isMac() ? "⌘" : "Ctrl+"}
                      {tool.keys}
                    </span>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </Fragment>
        ))}
      </div>
    </TooltipProvider>
  );
}
