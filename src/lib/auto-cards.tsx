"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { documentsQuery } from "./queries";

/*
 * Notes added to a subject turn into flashcards on their own: no "make a
 * reviewer" step. Each file is queued when it's added, and once it's been
 * read, its cards are made. The queue is kept in the browser, so it carries
 * on across pages and reloads.
 */

const KEY = "marginalia:auto-cards";
const EVENT = "marginalia:auto-cards";
const EMPTY: string[] = [];

let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    cache = [];
  }
  return cache!;
}

function write(ids: string[]) {
  cache = ids;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Private windows can block storage; the queue still works for this page
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Makes flashcards for these files once they've been read. */
export function queueCards(documentIds: string[]) {
  for (const id of documentIds) queuedAt.set(id, Date.now());
  write([...new Set([...read(), ...documentIds])]);
}

// When each file was queued on this page, so one the library hasn't listed yet isn't dropped
const queuedAt = new Map<string, number>();

const remove = (id: string) => write(read().filter((d) => d !== id));

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** Files waiting for their flashcards. */
export function useCardQueue() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const inFlight = new Set<string>();

/** Runs the queue. Rendered once, in the app shell. */
export function AutoCards() {
  const queryClient = useQueryClient();
  const queue = useCardQueue();
  const documents = useQuery({ ...documentsQuery, enabled: queue.length > 0 }).data;

  useEffect(() => {
    if (!documents) return;
    for (const id of queue) {
      const doc = documents.find((d) => d.id === id);
      if (!doc) {
        // Just added and not in the list yet: wait for the next refresh
        if (Date.now() - (queuedAt.get(id) ?? 0) < 60_000) {
          void queryClient.invalidateQueries({ queryKey: ["documents"] });
          continue;
        }
        remove(id);
        continue;
      }
      if (doc.status === "failed") {
        remove(id);
        continue;
      }
      if (doc.status !== "ready" || inFlight.has(id)) continue;
      inFlight.add(id);
      fetch("/api/decks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: id }) })
        .then(async (res) => {
          const body = await res.json().catch(() => null);
          if (res.ok) toast.success(`Flashcards ready from ${doc.filename}`);
          // 422: the subject's cards already cover this file
          else if (res.status !== 422) {
            toast.error(body?.error ?? `Couldn't make flashcards from ${doc.filename}.`);
          }
        })
        .catch(() => toast.error(`Couldn't make flashcards from ${doc.filename}.`))
        .finally(() => {
          inFlight.delete(id);
          remove(id);
          void queryClient.invalidateQueries({ queryKey: ["study"] });
        });
    }
  }, [documents, queue, queryClient]);

  return null;
}
