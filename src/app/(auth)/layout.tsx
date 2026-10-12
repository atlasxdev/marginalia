import Link from "next/link";
import { AuthShowcase } from "@/components/landing";
import { MarginNote, Wordmark } from "@/components/logo";

// Two columns on desktop: the form on the left, a frosted panel showing what
// Marginalia does on the right. Phones get the form alone.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="grid place-items-center px-5 py-20">
        <div className="w-full max-w-sm text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Link href="/" aria-label="Marginalia home" className="mb-12 inline-grid justify-items-end">
            <Wordmark className="text-5xl" />
            <MarginNote className="mt-1 mr-6">notes in the margin</MarginNote>
          </Link>
          {children}
        </div>
      </div>
      <div className="hidden p-3 lg:block">
        <div className="glass sticky top-3 grid h-[calc(100dvh-1.5rem)] place-items-center overflow-hidden rounded-3xl border border-glass-border bg-glass px-12 animate-in fade-in slide-in-from-right-4 duration-500">
          <AuthShowcase />
        </div>
      </div>
    </main>
  );
}
