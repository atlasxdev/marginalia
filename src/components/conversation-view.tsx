"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { DownloadIcon, LayersIcon, MessageSquareIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { conversationToMarkdown, downloadText } from "@/lib/export-markdown";
import { conversationQuery } from "@/lib/queries";
import { useAnswerStream } from "@/lib/use-answer-stream";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Answer } from "./answer";
import { Composer } from "./composer";
import { SourcesProvider, SourcesView } from "./sources";

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
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquareIcon />
          </EmptyMedia>
          <EmptyTitle>This conversation isn&apos;t available</EmptyTitle>
          <EmptyDescription>It may have been deleted.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/chat">Ask a new question</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <SourcesProvider>
      <div className="flex h-full">
        <div className="relative h-full min-w-0 flex-1">
          {/* Messages scroll under the floating composer */}
          <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-12 pt-14 pb-44">
              {isPending ? (
                <ConversationSkeleton />
              ) : (
                <>
                  {conversation?.space && (
                    <Link
                      href={`/spaces/${conversation.space.id}`}
                      className="glass mb-4 inline-flex max-w-full items-center gap-1.5 rounded-full border border-glass-border bg-glass px-3 py-1 text-sm hover:bg-glass-strong"
                    >
                      <LayersIcon className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate">{conversation.space.name}</span>
                    </Link>
                  )}
                  <div className="flex items-start gap-3">
                    <h1 className="min-w-0 flex-1 text-3xl font-bold tracking-tight text-balance wrap-anywhere">{conversation?.title}</h1>
                    {conversation && conversation.messages.length > 0 && (
                      <Button
                        variant="glass"
                        className="mt-0.5 shrink-0"
                        onClick={() =>
                          downloadText(
                            `${conversation.title.replace(/[\\/:*?"<>|]+/g, "").slice(0, 80) || "Conversation"}.md`,
                            conversationToMarkdown(conversation.title, conversation.messages)
                          )
                        }
                      >
                        <DownloadIcon />
                        Export
                      </Button>
                    )}
                  </div>
                </>
              )}

              <div className="mt-10 space-y-12">
                {conversation?.messages.map((m) =>
                  m.role === "user" ? (
                    <p
                      key={m.id}
                      className="glass border border-glass-border bg-glass-strong ml-auto w-fit max-w-[80%] origin-bottom-right rounded-2xl px-4 py-2.5 wrap-anywhere animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
                    >
                      {m.content}
                    </p>
                  ) : (
                    <Answer key={m.id} id={m.id} content={m.content} sources={m.sources} />
                  )
                )}

                {stream.status === "streaming" &&
                  (stream.text ? (
                    <Answer id="streaming" content={stream.text} sources={stream.sources} streaming />
                  ) : (
                    <p className="flex items-center gap-2 text-muted-foreground animate-in fade-in duration-200 motion-reduce:animate-none" role="status">
                      <Spinner />
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
              <div ref={endRef} className="scroll-mb-44" />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 px-5 sm:px-8 lg:px-12 pb-6">
            <Composer
              conversationId={id}
              busy={stream.busy}
              placeholder={conversation?.space ? `Ask ${conversation.space.name}` : undefined}
            />
          </div>
        </div>
        {/* Beside the chat on wide screens, a drawer below lg */}
        <SourcesView />
      </div>
    </SourcesProvider>
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
