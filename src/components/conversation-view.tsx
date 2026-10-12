"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDownIcon, LayersIcon, MessageSquareIcon, PinIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { conversationQuery } from "@/lib/queries";
import { useAnswerStream } from "@/lib/use-answer-stream";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Answer } from "./answer";
import { ChatMenu, FindInChat } from "./chat-tools";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  // Find in chat: opened from the menu, ⌘F, or a search result (?find=…)
  const findParam = useSearchParams().get("find") ?? "";
  const [finding, setFinding] = useState(!!findParam);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFinding(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Whether the reader is at the latest message; scrolling up stops the answer pulling them down
  const [atEnd, setAtEnd] = useState(true);
  const atEndRef = useRef(true);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const end = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    atEndRef.current = end;
    setAtEnd(end);
  };
  const toEnd = () => endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });

  const messageCount = conversation?.messages.length ?? 0;
  const streamedLength = stream.status === "streaming" ? stream.text.length : 0;
  // A new message always brings you down to it
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount]);
  // A streaming answer keeps you at the end, unless you've scrolled up to read
  useEffect(() => {
    if (atEndRef.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [streamedLength]);

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
          <div ref={scrollRef} className="h-full overflow-y-auto" onScroll={onScroll}>
            {/* The title and the chat's menu stay in reach while you scroll */}
            <header className="sticky top-0 z-10 px-5 pt-3 sm:px-8 lg:px-12">
              <div className="glass mx-auto flex h-14 max-w-4xl items-center gap-2 rounded-2xl border border-glass-border bg-glass-strong pr-2 pl-4">
                {isPending ? (
                  <Skeleton className="h-5 w-1/2" />
                ) : (
                  <>
                    {conversation?.pinned && <PinIcon aria-label="Pinned" className="size-4 shrink-0 text-primary" />}
                    <h1 className="min-w-0 flex-1 truncate font-semibold tracking-tight">{conversation?.title}</h1>
                    {conversation?.space && (
                      <Link
                        href={`/spaces/${conversation.space.id}`}
                        className="hidden max-w-48 shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15 sm:inline-flex"
                      >
                        <LayersIcon className="size-3.5 shrink-0" />
                        <span className="truncate">{conversation.space.name}</span>
                      </Link>
                    )}
                    {conversation && <ChatMenu conversation={conversation} onFind={() => setFinding(true)} />}
                  </>
                )}
              </div>
            </header>

            <div className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-12 pt-6 pb-44">
              {isPending && <ConversationSkeleton />}

              <div ref={messagesRef} className="space-y-12">
                {conversation?.messages.map((m) =>
                  m.role === "user" ? (
                    <p
                      key={m.id}
                      className="glass border border-glass-border bg-glass-strong ml-auto w-fit max-w-[80%] origin-bottom-right rounded-2xl px-4 py-2.5 wrap-anywhere animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
                    >
                      {m.content}
                    </p>
                  ) : (
                    <Answer key={m.id} id={m.id} content={m.content} sources={m.sources} conversationId={id} actions={m.actions} />
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

          <FindInChat
            open={finding}
            initial={findParam}
            onClose={() => setFinding(false)}
            root={messagesRef}
            scroller={scrollRef}
            version={`${messageCount}-${streamedLength}`}
          />

          {!atEnd && (
            <Button
              variant="glass"
              size="icon-lg"
              aria-label="Scroll to the latest message"
              onClick={toEnd}
              className="absolute bottom-32 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-lg animate-in fade-in zoom-in-90 duration-150 motion-reduce:animate-none"
            >
              <ArrowDownIcon />
            </Button>
          )}

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
