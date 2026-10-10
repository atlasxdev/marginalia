"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { conversationQuery } from "@/lib/queries";
import { useAnswerStream } from "@/lib/use-answer-stream";
import { useHydrated } from "@/lib/use-hydrated";
import { Answer } from "./answer";
import { Composer } from "./composer";

export function ConversationView({ id }: { id: string }) {
  const query = useQuery(conversationQuery(id));
  const hydrated = useHydrated();
  const conversation = hydrated ? query.data : undefined;
  const isPending = !hydrated || query.isPending;
  const error = hydrated ? query.error : null;
  const stream = useAnswerStream(conversation);
  const endRef = useRef<HTMLDivElement>(null);

  const messageCount = conversation?.messages.length ?? 0;
  const streamedLength = stream.status === "streaming" ? stream.text.length : 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount, streamedLength]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">This conversation isn&apos;t available</h1>
        <p className="mt-2 text-ink-soft">It may have been deleted.</p>
        <Link href="/chat" className="mt-6 inline-block font-medium text-pen hover:underline">
          Ask a new question
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8 lg:py-14">
          {isPending && <ConversationSkeleton />}

          <div className="space-y-14">
            {conversation?.messages.map((m) =>
              m.role === "user" ? (
                <h2
                  key={m.id}
                  className="max-w-[60ch] break-words border-l-2 border-highlight pl-4 text-xl leading-snug font-medium tracking-tight sm:text-[1.4rem]"
                >
                  {m.content}
                </h2>
              ) : (
                <Answer key={m.id} content={m.content} sources={m.sources} />
              )
            )}

            {stream.status === "streaming" &&
              (stream.text ? (
                <Answer content={stream.text} sources={stream.sources} streaming />
              ) : (
                <p className="text-sm text-ink-soft" role="status">
                  Searching your documents…
                </p>
              ))}

            {stream.status === "error" && (
              <div role="alert" className="max-w-[68ch] rounded-lg border border-danger/40 px-4 py-3">
                <p className="text-sm text-danger">{stream.error}</p>
                <button
                  onClick={stream.retry}
                  className="mt-2 text-sm font-medium text-ink underline-offset-4 hover:underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-rule bg-paper px-4 pt-3 pb-4 sm:px-8">
        <Composer conversationId={id} busy={stream.busy} />
      </div>
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="max-w-[68ch] animate-pulse space-y-4" aria-label="Loading conversation">
      <div className="h-6 w-2/3 rounded bg-rule/70" />
      <div className="h-4 w-full rounded bg-rule/50" />
      <div className="h-4 w-11/12 rounded bg-rule/50" />
      <div className="h-4 w-3/4 rounded bg-rule/50" />
    </div>
  );
}
