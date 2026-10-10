"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpIcon } from "lucide-react";
import { askQuestion, type AskState } from "@/app/actions/chat";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
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
      <label htmlFor="question" className="sr-only">
        Ask a question about your documents
      </label>
      <InputGroup className="rounded-3xl bg-card shadow-sm">
        <InputGroupTextarea
          ref={ref}
          id="question"
          name="question"
          rows={1}
          maxLength={MAX_QUESTION_CHARS}
          defaultValue={state.question}
          placeholder="Ask about your documents"
          aria-invalid={!!error}
          aria-describedby={error ? "question-error" : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!disabled) e.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-48 min-h-0 py-3 pl-5 text-[17px] leading-snug md:text-[17px]"
        />
        <InputGroupAddon align="inline-end" className="self-end pb-2">
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-sm"
            disabled={disabled}
            aria-label={pending ? "Sending" : "Ask"}
            className="rounded-full"
          >
            <ArrowUpIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error && (
        <p id="question-error" role="alert" className="mt-2 px-4 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
