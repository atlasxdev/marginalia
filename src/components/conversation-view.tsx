"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { conversationQuery } from "@/lib/queries";
import { useAnswerStream } from "@/lib/use-answer-stream";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
        <h1 className="text-2xl font-semibold">This conversation isn&apos;t available</h1>
        <p className="mt-2 text-muted-foreground">It may have been deleted.</p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/chat">Ask a new question</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {/* Messages scroll under the floating composer */}
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pt-10 pb-36 sm:px-6">
          {isPending ? (
            <ConversationSkeleton />
          ) : (
            <h1 className="text-3xl font-bold tracking-tight text-balance">{conversation?.title}</h1>
          )}

          <div className="mt-8 space-y-8">
            {conversation?.messages.map((m) =>
              m.role === "user" ? (
                <p
                  key={m.id}
                  className="glass border border-glass-border bg-glass-strong ml-auto w-fit max-w-[80%] rounded-2xl px-4 py-2.5 break-words"
                >
                  {m.content}
                </p>
              ) : (
                <Answer key={m.id} content={m.content} sources={m.sources} />
              )
            )}

            {stream.status === "streaming" &&
              (stream.text ? (
                <Answer content={stream.text} sources={stream.sources} streaming />
              ) : (
                <p className="text-muted-foreground" role="status">
                  Searching your documents…
                </p>
              ))}

            {stream.status === "error" && (
              <div role="alert" className="flex items-center gap-3">
                <p className="text-destructive">{stream.error}</p>
                <Button variant="link" className="h-auto p-0" onClick={stream.retry}>
                  Try again
                </Button>
              </div>
            )}
          </div>
          <div ref={endRef} className="scroll-mb-36" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 sm:px-6">
        <Composer conversationId={id} busy={stream.busy} />
      </div>
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading conversation">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
    </div>
  );
}
