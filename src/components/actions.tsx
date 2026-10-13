"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CopyIcon,
  GalleryVerticalEndIcon,
  ListChecksIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import { isDue } from "@/lib/leitner";
import { conversationQuery } from "@/lib/queries";
import type { Action, ActionKind, Conversation, Source } from "@/lib/types";
import { sourceName } from "@/lib/use-study";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useSources } from "./sources";
import { StudyButtons, deckStatus } from "./deck";
import { useStudySession } from "./study";

// The actions that can be made from an answer so far
const ACTIONS: { kind: ActionKind; label: string; pending: string; icon: LucideIcon }[] = [
  { kind: "flashcards", label: "Make flashcards", pending: "Making flashcards…", icon: GalleryVerticalEndIcon },
  { kind: "checklist", label: "Make a checklist", pending: "Making a checklist…", icon: ListChecksIcon },
];

// Applies a change to one answer's actions in the cached conversation
function useUpdateActions(conversationId: string, messageId: string | null) {
  const queryClient = useQueryClient();
  return (update: (actions: Action[]) => Action[]) =>
    queryClient.setQueryData<Conversation>(conversationQuery(conversationId).queryKey, (c) =>
      c && {
        ...c,
        messages: c.messages.map((m) => (m.id === messageId ? { ...m, actions: update(m.actions) } : m)),
      }
    );
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Something went wrong. Try again.");
  return (res.status === 204 ? null : await res.json()) as T;
}

/** Buttons under an answer that make something from it. */
export function ActionBar({ conversationId, messageId }: { conversationId: string; messageId: string }) {
  const updateActions = useUpdateActions(conversationId, messageId);
  const make = useMutation({
    mutationFn: (kind: ActionKind) =>
      send<Action>(`/api/messages/${messageId}/actions`, { method: "POST", body: JSON.stringify({ kind }) }),
    onSuccess: (action) => updateActions((actions) => [...actions, action]),
    onError: (error) => toast.error(error.message),
  });

  return ACTIONS.map(({ kind, label, pending, icon: Icon }) => {
    const busy = make.isPending && make.variables === kind;
    return (
      <Button
        key={kind}
        type="button"
        variant="ghost"
        size="sm"
        disabled={make.isPending}
        onClick={() => make.mutate(kind)}
        className="text-muted-foreground"
      >
        {busy ? <Spinner /> : <Icon />}
        {busy ? pending : label}
      </Button>
    );
  });
}

type CardProps<K extends ActionKind = ActionKind> = {
  conversationId: string;
  action: Extract<Action, { kind: K }>;
  sources: Source[];
};

/** Something made from an answer, shown under it. */
export function ActionCard({ action, ...props }: CardProps) {
  switch (action.kind) {
    case "checklist":
      return <ChecklistCard action={action} {...props} />;
    case "flashcards":
      return <FlashcardsCard action={action} {...props} />;
  }
}

function FlashcardsCard({ conversationId, action, sources }: CardProps<"flashcards">) {
  const { cards, title } = action.payload;
  const session = useStudySession([action], sources);
  const progress = session.progressOf(action);
  const due = cards.filter((_, i) => isDue(progress[i])).length;

  return (
    <ActionShell
      icon={GalleryVerticalEndIcon}
      title={title}
      action={action}
      conversationId={conversationId}
      copyText={() => [title, ...cards.map((c) => `Q: ${c.front}\nA: ${c.back}`)].join("\n\n")}
      footer={deckStatus(cards.length, due, progress)}
    >
      <ul className="grid gap-1 px-2 pb-1 text-muted-foreground">
        {cards.slice(0, 3).map((c, i) => (
          <li key={i} className="truncate">
            {c.front}
          </li>
        ))}
        {cards.length > 3 && <li className="text-xs">and {cards.length - 3} more</li>}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2 px-2">
        <StudyButtons due={due} total={cards.length} onStart={(mode) => session.start(mode, title)} />
      </div>
      {session.dialog}
    </ActionShell>
  );
}

function ChecklistCard({ conversationId, action, sources }: CardProps<"checklist">) {
  const updateActions = useUpdateActions(conversationId, action.messageId);
  const { items, title } = action.payload;
  const [done, setDone] = useState(() => new Set(action.state.done ?? []));

  const save = useMutation({
    mutationFn: (next: number[]) =>
      send(`/api/actions/${action.id}`, { method: "PATCH", body: JSON.stringify({ done: next }) }),
    onSuccess: (_, next) =>
      updateActions((actions) => actions.map((a) => (a.id === action.id ? ({ ...a, state: { done: next } } as Action) : a))),
    onError: (error) => toast.error(error.message),
  });

  const toggle = (i: number, checked: boolean) => {
    const next = new Set(done);
    if (checked) next.add(i);
    else next.delete(i);
    setDone(next);
    save.mutate([...next].sort((a, b) => a - b));
  };

  const asText = () =>
    [title, ...items.map((item, i) => `${done.has(i) ? "[x]" : "[ ]"} ${item.text}${item.due ? ` (${item.due})` : ""}`)].join("\n");

  return (
    <ActionShell
      icon={ListChecksIcon}
      title={title}
      action={action}
      conversationId={conversationId}
      copyText={asText}
      footer={`${done.size} of ${items.length} done`}
    >
      <ul className="grid gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 rounded-lg px-2 py-2 has-[button:hover]:bg-foreground/[0.03]">
            <Checkbox
              id={`${action.id}-${i}`}
              checked={done.has(i)}
              onCheckedChange={(checked) => toggle(i, checked === true)}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <label
                htmlFor={`${action.id}-${i}`}
                className={cn(
                  "block cursor-pointer leading-snug transition-colors duration-150",
                  done.has(i) && "text-muted-foreground line-through decoration-muted-foreground/60"
                )}
              >
                {item.text}
              </label>
              <ItemMeta due={item.due} source={sources.find((s) => s.chunkId === item.sourceId)} viewKey={action.id} />
            </div>
          </li>
        ))}
      </ul>
    </ActionShell>
  );
}

// The deadline and a link to the passage an item came from
function ItemMeta({ due, source, viewKey }: { due: string | null; source?: Source; viewKey: string }) {
  const view = useSources();
  if (!due && !source) return null;
  return (
    <div className="mt-1 grid justify-items-start gap-0.5 text-xs text-muted-foreground">
      {due && <span className="font-medium text-foreground/80">{due}</span>}
      {source && (
        <button
          type="button"
          onClick={() => view.show(viewKey, [{ ...source, index: 1 }], 1)}
          className="max-w-full truncate text-left hover:text-primary hover:underline"
        >
          {sourceName(source)}
        </button>
      )}
    </div>
  );
}

function ActionShell({
  icon: Icon,
  title,
  action,
  conversationId,
  copyText,
  footer,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action: Action;
  conversationId: string;
  copyText: () => string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const updateActions = useUpdateActions(conversationId, action.messageId);
  const remove = useMutation({
    mutationFn: () => send(`/api/actions/${action.id}`, { method: "DELETE" }),
    onSuccess: () => updateActions((actions) => actions.filter((a) => a.id !== action.id)),
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card className="glass mt-4 gap-3 border border-glass-border bg-glass ring-0 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold">
          <Icon className="size-4 text-primary" aria-hidden />
          {title}
        </CardTitle>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`More for ${title}`} className="-my-1 text-muted-foreground">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={async () => {
                  await navigator.clipboard.writeText(copyText());
                  toast.success("Copied");
                }}
              >
                <CopyIcon />
                Copy as text
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={remove.isPending} onSelect={() => remove.mutate()}>
                <Trash2Icon />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2">{children}</CardContent>
      <CardFooter className="border-t border-glass-border py-3 text-xs text-muted-foreground">{footer}</CardFooter>
    </Card>
  );
}
