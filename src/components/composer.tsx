"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpIcon } from "lucide-react";
import { askQuestion, type AskState } from "@/app/actions/chat";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { MAX_QUESTION_CHARS } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type ComposerProps = {
  conversationId?: string;
  /** Starts the new conversation in this space. */
  spaceId?: string;
  placeholder?: string;
  busy?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  className?: string;
};

export function Composer({ conversationId, spaceId, placeholder = "Ask about your documents", busy = false, textareaRef, className }: ComposerProps) {
  const [state, formAction, pending] = useActionState<AskState, FormData>(askQuestion, { ok: false });
  const queryClient = useQueryClient();
  const router = useRouter();
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? localRef;
  // Unique, since a page kept in the background can have its own composer
  const inputId = useId();
  // Pages kept in the background re-run effects when shown again, so act on each answer once;
  // otherwise coming back to this page would jump to the last conversation
  const handled = useRef<AskState>(null);

  useEffect(() => {
    if (!state.ok || !state.conversationId || handled.current === state) return;
    handled.current = state;
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    if (!conversationId) router.push(`/chat/${state.conversationId}`);
  }, [state, conversationId, queryClient, router]);

  const error = state.fieldErrors?.question?.[0] ?? (!state.ok ? state.message : undefined);
  const disabled = pending || busy;

  return (
    <form action={formAction} className={cn("mx-auto w-full max-w-4xl", className)}>
      {conversationId && <input type="hidden" name="conversationId" value={conversationId} />}
      {!conversationId && spaceId && <input type="hidden" name="spaceId" value={spaceId} />}
      <Label htmlFor={inputId} className="sr-only">
        Ask a question about your documents
      </Label>
      <InputGroup className="glass border border-glass-border bg-glass-strong rounded-3xl dark:bg-glass-strong">
        <InputGroupTextarea
          ref={ref}
          id={inputId}
          name="question"
          rows={1}
          maxLength={MAX_QUESTION_CHARS}
          defaultValue={state.question}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
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
            className="rounded-full transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-85 data-[pending=true]:scale-90"
            data-pending={pending}
          >
            {/* The arrow flies up while the question is sent */}
            <ArrowUpIcon className={cn("transition-transform duration-200", pending && "-translate-y-0.5 animate-pulse motion-reduce:animate-none")} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-2 px-4 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
