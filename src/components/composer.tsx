"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { askQuestion, type AskState } from "@/app/actions/chat";
import { MAX_QUESTION_CHARS } from "@/lib/schemas";

type ComposerProps = {
  conversationId?: string;
  busy?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
};

export function Composer({ conversationId, busy = false, textareaRef }: ComposerProps) {
  const [state, formAction, pending] = useActionState<AskState, FormData>(askQuestion, { ok: false });
  const queryClient = useQueryClient();
  const router = useRouter();
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? localRef;

  useEffect(() => {
    if (!state.ok || !state.conversationId) return;
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    if (!conversationId) router.push(`/chat/${state.conversationId}`);
  }, [state, conversationId, queryClient, router]);

  const error = state.fieldErrors?.question?.[0] ?? (!state.ok ? state.message : undefined);
  const disabled = pending || busy;

  return (
    <form action={formAction} className="mx-auto w-full max-w-3xl">
      {conversationId && <input type="hidden" name="conversationId" value={conversationId} />}
      <div className="rounded-xl border border-rule bg-sheet p-2 shadow-[0_1px_0_var(--rule)] focus-within:border-pen">
        <label htmlFor="question" className="sr-only">
          Ask a question about your documents
        </label>
        <textarea
          ref={ref}
          id="question"
          name="question"
          rows={2}
          maxLength={MAX_QUESTION_CHARS}
          defaultValue={state.question}
          placeholder="Ask about your documents…"
          aria-invalid={!!error}
          aria-describedby={error ? "question-error" : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!disabled) e.currentTarget.form?.requestSubmit();
            }
          }}
          className="block max-h-48 w-full resize-none bg-transparent px-2.5 py-2 text-[15px] leading-relaxed outline-none placeholder:text-ink-soft/70"
        />
        <div className="flex items-center justify-between gap-3 pl-2.5">
          <p className="text-xs text-ink-soft">
            <span className="hidden sm:inline">Enter to send, Shift + Enter for a new line</span>
          </p>
          <button
            type="submit"
            disabled={disabled}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Ask"}
          </button>
        </div>
      </div>
      {error && (
        <p id="question-error" role="alert" className="mt-2 px-1 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
