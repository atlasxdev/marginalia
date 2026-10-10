"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Conversation, Source } from "./types";

type StreamState =
  | { status: "idle" }
  | { status: "streaming"; text: string; sources: Source[] }
  | { status: "error"; error: string };

// Streams an answer whenever the conversation's latest message is an unanswered question.
export function useAnswerStream(conversation: Conversation | undefined) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StreamState>({ status: "idle" });
  const startedFor = useRef<string | null>(null);

  const last = conversation?.messages.at(-1);
  const pendingQuestionId = last?.role === "user" ? last.id : null;

  const run = useCallback(
    async (conversationId: string) => {
      setState({ status: "streaming", text: "", sources: [] });
      try {
        const res = await fetch(`/api/conversations/${conversationId}/answer`, { method: "POST" });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          throw new Error(
            res.status === 429
              ? body?.error ?? "Daily question limit reached. Try again tomorrow."
              : body?.error ?? "Something went wrong while answering. Try again."
          );
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        let sources: Source[] | null = null;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value;
          if (!sources) {
            const newline = buffer.indexOf("\n");
            if (newline === -1) continue;
            sources = JSON.parse(buffer.slice(0, newline)).sources as Source[];
            buffer = buffer.slice(newline + 1);
          }
          setState({ status: "streaming", text: buffer, sources });
        }

        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
        setState({ status: "idle" });
      } catch (err) {
        setState({ status: "error", error: (err as Error).message });
      }
    },
    [queryClient]
  );

  useEffect(() => {
    if (!conversation || !pendingQuestionId || startedFor.current === pendingQuestionId) return;
    startedFor.current = pendingQuestionId;
    void run(conversation.id);
  }, [conversation, pendingQuestionId, run]);

  const retry = useCallback(() => {
    if (conversation) void run(conversation.id);
  }, [conversation, run]);

  return { ...state, retry, busy: state.status === "streaming" };
}
