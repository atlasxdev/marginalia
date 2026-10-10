import { cn } from "@/lib/utils";

// The Marginalia mark: an arched "m" on a baseline, like a manuscript initial,
// with diamonds in the highlight yellow that marks cited passages.
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("text-primary", className)}>
      <path
        d="M10 50V30a11 11 0 0 1 22 0v20M32 50V30a11 11 0 0 1 22 0v20"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <rect x="3" y="52.5" width="58" height="3.5" rx="1.75" fill="currentColor" />
      <path d="M32 31l2 3.2-2 3.2-2-3.2zM32 40l2 3.2-2 3.2-2-3.2z" fill="var(--highlight)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-serif text-xl font-semibold", className)}>
      <AppIcon className="size-7" />
      marginalia
    </span>
  );
}
