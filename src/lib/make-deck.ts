type DeckEvent = { deck?: unknown; added?: number; total?: number; done?: boolean; error?: string; nothingNew?: boolean };

/** Nothing new to make: the notes are already covered, or too thin for cards. */
export class NothingNewError extends Error {}

/* Reads the reviewer's progress as it's made: the deck arrives with its first
   cards, more are added as the other parts finish. */
export async function makeDeck(body: { documentId: string } | { spaceId: string }, onEvent: (e: DeckEvent) => void) {
  const res = await fetch("/api/decks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't make the reviewer. Try again.");
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      const event = JSON.parse(line) as DeckEvent;
      if (event.error) throw event.nothingNew ? new NothingNewError(event.error) : new Error(event.error);
      onEvent(event);
    }
  }
}
