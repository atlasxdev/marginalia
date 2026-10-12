"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  FileTextIcon,
  FilesIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { conversationToMarkdown, downloadText } from "@/lib/export-markdown";
import type { CitedSource } from "@/lib/format-response";
import type { Conversation, Source } from "@/lib/types";
import { DeleteConversation, RenameConversation, usePinConversation } from "./conversation-actions";
import { SourceViewer } from "./source-viewer";

/* ---------- the chat's menu ---------- */

/** Rename, pin, find, files, export and delete, from the ⋯ beside the title. */
export function ChatMenu({ conversation, onFind }: { conversation: Conversation; onFind: () => void }) {
  const router = useRouter();
  const pin = usePinConversation();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [files, setFiles] = useState(false);
  const docs = citedDocuments(conversation);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Chat options" className="shrink-0">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-56">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => pin.mutate({ id: conversation.id, pinned: !conversation.pinned })}>
            {conversation.pinned ? <PinOffIcon /> : <PinIcon />}
            {conversation.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onFind}>
            <SearchIcon />
            Find in chat
            <DropdownMenuShortcut>⌘F</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFiles(true)} disabled={docs.length === 0}>
            <FilesIcon />
            Files in this chat
            {docs.length > 0 && <DropdownMenuShortcut>{docs.length}</DropdownMenuShortcut>}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={conversation.messages.length === 0}
            onSelect={() => {
              downloadText(
                `${conversation.title.replace(/[\\/:*?"<>|]+/g, "").slice(0, 80) || "Conversation"}.md`,
                conversationToMarkdown(conversation.title, conversation.messages)
              );
              toast.success("Exported as Markdown");
            }}
          >
            <DownloadIcon />
            Export as Markdown
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameConversation conversation={renaming ? conversation : null} onClose={() => setRenaming(false)} />
      <DeleteConversation conversation={deleting ? conversation : null} onClose={() => setDeleting(false)} onDeleted={() => router.push("/chat")} />
      <FilesInChat open={files} onOpenChange={setFiles} docs={docs} />
    </>
  );
}

/* ---------- files in this chat ---------- */

type CitedDoc = { id: string; title: string; count: number; first: Source };

/** Every document the answers cited, most cited first. */
function citedDocuments(conversation: Conversation): CitedDoc[] {
  const docs = new Map<string, CitedDoc>();
  for (const m of conversation.messages) {
    for (const s of m.sources ?? []) {
      const d = docs.get(s.documentId);
      if (d) d.count++;
      else docs.set(s.documentId, { id: s.documentId, title: s.documentTitle, count: 1, first: s });
    }
  }
  return [...docs.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

function FilesInChat({ open, onOpenChange, docs }: { open: boolean; onOpenChange: (open: boolean) => void; docs: CitedDoc[] }) {
  const [viewing, setViewing] = useState<CitedSource | null>(null);
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass border border-glass-border bg-glass-strong sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Files in this chat</DialogTitle>
            <DialogDescription>The documents these answers came from.</DialogDescription>
          </DialogHeader>
          <ItemGroup className="mt-2 max-h-[60dvh] gap-1 overflow-y-auto">
            {docs.map((d) => (
              <Item key={d.id} size="sm" className="rounded-xl px-3 hover:bg-glass">
                <ItemMedia variant="icon">
                  <FileTextIcon className="text-primary" />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="truncate">{d.title}</ItemTitle>
                  <ItemDescription>
                    Cited {d.count} {d.count === 1 ? "time" : "times"}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button variant="glass" size="sm" onClick={() => setViewing({ ...d.first, index: 1 })}>
                    Open
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </DialogContent>
      </Dialog>
      <SourceViewer source={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

/* ---------- find in chat ---------- */

// Matches are painted with the CSS Custom Highlight API, so the answers'
// markup is never touched. Styles: ::highlight(find) in globals.css.
const supported = () => typeof CSS !== "undefined" && "highlights" in CSS;

/** Ranges for every case-insensitive match of `q` in `root`'s text. */
function findRanges(root: HTMLElement, q: string) {
  const ranges: Range[] = [];
  const needle = q.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.toLowerCase() ?? "";
    for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + needle.length)) {
      const r = new Range();
      r.setStart(node, at);
      r.setEnd(node, at + needle.length);
      ranges.push(r);
    }
  }
  return ranges;
}

/**
 * A find bar over the chat: type to highlight every match, Enter / Shift+Enter
 * (or the arrows) to step through them, Escape to close.
 */
export function FindInChat({
  open,
  initial,
  onClose,
  root,
  scroller,
  version,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  /** The messages to search. */
  root: React.RefObject<HTMLElement | null>;
  /** The element that scrolls them. */
  scroller: React.RefObject<HTMLElement | null>;
  /** Changes when the messages do, so matches are found again. */
  version: unknown;
}) {
  const [q, setQ] = useState(initial);
  const [found, setFound] = useState({ count: 0, index: 0 });
  const ranges = useRef<Range[]>([]);
  const input = useRef<HTMLInputElement>(null);

  // Find and paint the matches
  useEffect(() => {
    if (!supported()) return;
    const term = open ? q.trim() : "";
    ranges.current = term.length >= 1 && root.current ? findRanges(root.current, term) : [];
    CSS.highlights.set("find", new Highlight(...ranges.current));
    const id = requestAnimationFrame(() => setFound({ count: ranges.current.length, index: 0 }));
    return () => cancelAnimationFrame(id);
  }, [open, q, version, root]);

  // Mark the current match and bring it into view
  useEffect(() => {
    if (!supported()) return;
    const r = ranges.current[found.index];
    CSS.highlights.set("find-current", r ? new Highlight(r) : new Highlight());
    const box = scroller.current;
    if (!r || !box) return;
    const rect = r.getBoundingClientRect();
    const view = box.getBoundingClientRect();
    if (rect.top < view.top + 80 || rect.bottom > view.bottom - 180) {
      box.scrollBy({ top: rect.top - view.top - view.height / 3, behavior: "smooth" });
    }
  }, [found, scroller]);

  // Clear the paint when the bar closes or the chat changes
  useEffect(() => {
    if (!open && supported()) {
      CSS.highlights.delete("find");
      CSS.highlights.delete("find-current");
    }
  }, [open]);
  useEffect(() => () => {
    if (supported()) {
      CSS.highlights.delete("find");
      CSS.highlights.delete("find-current");
    }
  }, []);

  useEffect(() => {
    if (open) input.current?.select();
  }, [open]);

  const step = (by: 1 | -1) =>
    setFound((f) => (f.count ? { ...f, index: (f.index + by + f.count) % f.count } : f));

  if (!open) return null;
  return (
    <div className="glass absolute top-[5.25rem] right-5 z-20 flex h-11 w-[min(24rem,calc(100%-2.5rem))] items-center gap-1 rounded-xl border border-glass-border bg-glass-strong pr-1 pl-3 animate-in fade-in slide-in-from-top-2 duration-150 motion-reduce:animate-none sm:right-8 lg:right-12">
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
      <input
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            step(e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") onClose();
        }}
        placeholder="Find in chat"
        aria-label="Find in chat"
        className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
      />
      <span className="shrink-0 px-1 text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {q.trim() ? (found.count ? `${found.index + 1} of ${found.count}` : "No matches") : ""}
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Previous match" disabled={!found.count} onClick={() => step(-1)}>
        <ChevronUpIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Next match" disabled={!found.count} onClick={() => step(1)}>
        <ChevronDownIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Close find" onClick={onClose}>
        <XIcon />
      </Button>
    </div>
  );
}
