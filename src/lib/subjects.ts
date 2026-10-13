import { isDue } from "./leitner";
import type { Deck, Space, WeakTopic } from "./types";

/* Everything starts from a subject: its reviewers, what's due and what's weak.
   A deck belongs to a subject when it was made from it, from an answer in one
   of its chats, or from one of its files. */

export const deckInSubject = (deck: Deck, space: Space) =>
  deck.subjectId === space.id || (!!deck.documentId && space.documentIds.includes(deck.documentId));

export const subjectDecks = (decks: Deck[], space: Space) => decks.filter((d) => deckInSubject(d, space));

/** Cards due now across decks. */
export const dueCount = (decks: Deck[]) =>
  decks.reduce((n, d) => n + d.payload.cards.filter((_, i) => isDue(d.state.cards?.[i])).length, 0);

/** Cards waiting: reviews the schedule says are due, and new cards not seen yet. */
export function cardCounts(decks: Deck[], now = new Date()) {
  let review = 0;
  let fresh = 0;
  for (const d of decks)
    d.payload.cards.forEach((_, i) => {
      const p = d.state.cards?.[i];
      if (!p) fresh++;
      else if (new Date(p.due) <= now) review++;
    });
  return { review, fresh };
}

/** "5 to review and 9 new", in words. */
export function waitingLine({ review, fresh }: { review: number; fresh: number }) {
  if (review && fresh) return `${review} to review and ${fresh} new`;
  if (review) return `${review} ${review === 1 ? "card" : "cards"} to review`;
  if (fresh) return `${fresh} new ${fresh === 1 ? "card" : "cards"} to learn`;
  return "";
}

/** Weak topics whose cards are in these decks. */
export function topicsIn(topics: WeakTopic[], decks: Deck[]) {
  const ids = new Set(decks.map((d) => d.id));
  return topics.filter((t) => t.cards.some((c) => ids.has(c.deckId)));
}

/** Subjects ranked by what they need: reviews due first, then weak topics, then new cards. */
export function rankSubjects(spaces: Space[], decks: Deck[], weakTopics: WeakTopic[]) {
  return spaces
    .map((space) => {
      const sd = subjectDecks(decks, space);
      const counts = cardCounts(sd);
      const weak = topicsIn(weakTopics, sd);
      return { space, counts, weak, score: counts.review * 3 + weak.length * 2 + (counts.fresh ? 1 : 0) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Where to study: a subject, one deck, or one weak topic (optionally within a subject). */
export type SessionScope = { subject?: string; deck?: string; topic?: string };

export function sessionHref(scope: SessionScope) {
  const params = new URLSearchParams(Object.entries(scope).filter(([, v]) => v) as [string, string][]);
  const query = params.toString();
  return query ? `/session?${query}` : "/session";
}
