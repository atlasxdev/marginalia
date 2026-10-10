import { SparkleIcon } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-4 py-16">
      <AuthGlow />
      <div className="w-full max-w-lg">
        <p className="mx-auto mb-8 flex w-fit items-center gap-1.5 rounded-lg bg-card/70 px-3 py-1 text-sm shadow-lift-1 backdrop-blur">
          <span className="font-semibold tracking-tight">Marginalia</span>
          <SparkleIcon className="size-3.5 fill-highlight text-highlight" aria-hidden />
          <span className="text-muted-foreground">answers with sources</span>
        </p>
        {children}
      </div>
    </main>
  );
}

// Soft light bleeding in from the edges: highlighter yellow and ballpoint blue
function AuthGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -bottom-1/3 -left-1/4 size-[60rem] animate-drift rounded-full bg-highlight opacity-35 blur-[120px] dark:opacity-15" />
      <div className="absolute -right-1/4 -bottom-1/2 size-[55rem] animate-drift rounded-full bg-ring opacity-25 blur-[140px] [animation-delay:-9s] dark:opacity-40" />
      <div className="absolute -top-1/2 left-1/3 size-[40rem] animate-drift rounded-full bg-ring opacity-10 blur-[120px] [animation-delay:-4s] dark:opacity-20" />
    </div>
  );
}
