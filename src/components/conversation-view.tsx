"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { conversationQuery } from "@/lib/queries";
import { useAnswerStream } from "@/lib/use-answer-stream";
import { useHydrated } from "@/lib/use-hydrated";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
        <h1 className="text-xl font-semibold">This conversation isn&apos;t available</h1>
        <p className="mt-2 text-muted-foreground">It may have been deleted.</p>
        <Button asChild className="mt-6">
          <Link href="/chat">Ask a new question</Link>
        </Button>
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
                <p className="text-sm text-muted-foreground" role="status">
                  Searching your documents…
                </p>
              ))}

            {stream.status === "error" && (
              <Alert variant="destructive" className="max-w-[68ch] bg-card shadow-lift-1">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                  <span>{stream.error}</span>
                  <Button variant="paper" size="sm" onClick={stream.retry}>
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
          <div ref={endRef} />
        </div>
      </div>

      <div className="px-4 pt-2 pb-4 sm:px-8">
        <Composer conversationId={id} busy={stream.busy} />
      </div>
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="max-w-[68ch] space-y-4" aria-label="Loading conversation">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
