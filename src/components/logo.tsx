import { cn } from "@/lib/utils";

// Hand-drawn margin bracket; the right one is the same shape mirrored
const BRACKET =
  "M16 3c-5 .5-9 0-11.5.8C3.4 20 4.6 50 3.6 70c-.3 9 .6 18 .2 26 3.6.8 8 .2 12.2.6l.4-5c-2.6-.4-5.2 0-7.6-.4.5-8-.3-17 .1-25 .6-19-.3-42 .4-58 2.4-.4 5 .1 7.2-.3z";

function Bracket({ side }: { side: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 20 100"
      aria-hidden
      className={cn("h-[1.2em] w-[0.24em] shrink-0 text-primary", side === "right" && "-scale-x-100")}
    >
      <path d={BRACKET} fill="currentColor" />
    </svg>
  );
}

// "[marginalia]": a serif wordmark set between two margin brackets
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[0.1em] font-serif font-semibold leading-none", className)}>
      <Bracket side="left" />
      <span aria-hidden className="pb-[0.08em]">marginalia</span>
      <Bracket side="right" />
      <span className="sr-only">Marginalia</span>
    </span>
  );
}

// The handwritten note under the wordmark on the sign-in screens
export function MarginNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("-rotate-3 font-hand text-2xl text-primary", className)}>{children}</p>;
}
