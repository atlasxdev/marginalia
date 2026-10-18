"use client";

import { useState, useSyncExternalStore } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteConversation, pinConversation, renameConversation, reorderConversations } from "@/lib/writes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Conversation, ConversationSummary } from "@/lib/types";

/*
 * What you can do to a conversation, shared by the sidebar and the chat page:
 * rename, pin, reorder and delete. Each updates the cached list right away and
 * puts it back if the server says no.
 */

const LIST = ["conversations"];

/** Applies `change` to the conversation in the list and in its own cache entry. */
function useOptimistic() {
  const queryClient = useQueryClient();
  return async (id: string, change: Partial<ConversationSummary>) => {
    await queryClient.cancelQueries({ queryKey: LIST, exact: true });
    const previous = queryClient.getQueryData<ConversationSummary[]>(LIST);
    const previousOne = queryClient.getQueryData<Conversation>([...LIST, id]);
    queryClient.setQueryData<ConversationSummary[]>(LIST, (list) => list?.map((c) => (c.id === id ? { ...c, ...change } : c)));
    queryClient.setQueryData<Conversation>([...LIST, id], (c) => (c ? { ...c, ...change } : c));
    return () => {
      queryClient.setQueryData(LIST, previous);
      queryClient.setQueryData([...LIST, id], previousOne);
    };
  };
}

export function usePinConversation() {
  const optimistic = useOptimistic();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => pinConversation(id, pinned),
    onMutate: ({ id, pinned }) => optimistic(id, { pinned }),
    onSuccess: (result, { pinned }, undo) => {
      if (!result.ok) {
        undo?.();
        return toast.error(result.message ?? "Couldn't do that. Try again.");
      }
      toast.success(pinned ? "Pinned" : "Unpinned");
    },
    onError: (_e, _v, undo) => undo?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: LIST, exact: true }),
  });
}

/** Saves a manual order (ids, first to last) and shows it straight away. */
export function useReorderConversations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reorderConversations,
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: LIST, exact: true });
      const previous = queryClient.getQueryData<ConversationSummary[]>(LIST);
      const rank = new Map(ids.map((id, i) => [id, i + 1]));
      queryClient.setQueryData<ConversationSummary[]>(LIST, (list) =>
        list?.map((c) => (rank.has(c.id) ? { ...c, position: rank.get(c.id)! } : c))
      );
      return () => queryClient.setQueryData(LIST, previous);
    },
    onSuccess: (result, _ids, undo) => {
      if (!result.ok) {
        undo?.();
        toast.error(result.message ?? "Couldn't save the order. Try again.");
      }
    },
    onError: (_e, _v, undo) => undo?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: LIST, exact: true }),
  });
}

/* ---------- sorting ---------- */

export type ChatSort = "updated" | "manual";
const SORT_KEY = "marginalia:chat-sort";
const sortListeners = new Set<() => void>();

/** How the sidebar orders conversations; remembered on this device. */
export function useChatSort() {
  const sort = useSyncExternalStore(
    (on) => {
      sortListeners.add(on);
      return () => sortListeners.delete(on);
    },
    () => {
      try {
        return (localStorage.getItem(SORT_KEY) as ChatSort | null) ?? "updated";
      } catch {
        return "updated";
      }
    },
    () => "updated" as ChatSort
  );
  const setSort = (next: ChatSort) => {
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {}
    sortListeners.forEach((on) => on());
  };
  return [sort, setSort] as const;
}

/** Newest first, or your order: conversations you haven't placed yet sit at the top. */
export function sortConversations(list: ConversationSummary[], sort: ChatSort) {
  const byUpdated = (a: ConversationSummary, b: ConversationSummary) => b.updatedAt.localeCompare(a.updatedAt);
  if (sort === "updated") return [...list].sort(byUpdated);
  return [...list].sort((a, b) => {
    if (a.position === null || b.position === null) {
      if (a.position === b.position) return byUpdated(a, b);
      return a.position === null ? -1 : 1;
    }
    return a.position - b.position;
  });
}

/* ---------- dialogs ---------- */

export function RenameConversation({ conversation, onClose }: { conversation: { id: string; title: string } | null; onClose: () => void }) {
  return (
    <Dialog open={!!conversation} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass border border-glass-border bg-glass-strong sm:max-w-xl">
        {conversation && <RenameForm key={conversation.id} conversation={conversation} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ conversation, onClose }: { conversation: { id: string; title: string }; onClose: () => void }) {
  const [title, setTitle] = useState(conversation.title);
  const optimistic = useOptimistic();
  const queryClient = useQueryClient();
  const rename = useMutation({
    mutationFn: () => renameConversation(conversation.id, title),
    onMutate: () => optimistic(conversation.id, { title: title.trim() }),
    onSuccess: (result, _v, undo) => {
      if (!result.ok) {
        undo?.();
        return toast.error(result.message ?? "Couldn't rename this conversation. Try again.");
      }
      toast.success("Renamed");
      onClose();
    },
    onError: (_e, _v, undo) => undo?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: LIST }),
  });
  const empty = !title.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!empty && title.trim() !== conversation.title) rename.mutate();
        else onClose();
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename conversation</DialogTitle>
      </DialogHeader>
      <Field className="mt-5">
        <FieldLabel htmlFor="rename-title" className="sr-only">
          Name
        </FieldLabel>
        <Input
          id="rename-title"
          value={title}
          maxLength={200}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={empty}
          className="h-10 rounded-xl bg-popover"
        />
        {empty && <FieldError>Give it a name.</FieldError>}
      </Field>
      <DialogFooter className="mt-6">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={empty || rename.isPending}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

// Confirms, then removes a conversation; the sidebar list updates right away
export function DeleteConversation({
  conversation,
  onClose,
  onDeleted,
}: {
  conversation: { id: string; title: string } | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: deleteConversation,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: LIST, exact: true });
      const previous = queryClient.getQueryData<ConversationSummary[]>(LIST);
      queryClient.setQueryData<ConversationSummary[]>(LIST, (list) => list?.filter((c) => c.id !== id));
      return { previous };
    },
    onError: (_err, _id, ctx) => queryClient.setQueryData(LIST, ctx?.previous),
    onSuccess: (result, id, ctx) => {
      if (!result.ok) {
        toast.error(result.message ?? "Couldn't delete this conversation. Try again.");
        return queryClient.setQueryData(LIST, ctx?.previous);
      }
      toast.success("Conversation deleted");
      queryClient.removeQueries({ queryKey: [...LIST, id], exact: true });
      onDeleted?.(id);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: LIST, exact: true }),
  });

  return (
    <AlertDialog open={!!conversation} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="border border-glass-border bg-popover">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{conversation?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The conversation and its answers will be removed. Your documents stay in your library.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => conversation && remove.mutate(conversation.id)}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
