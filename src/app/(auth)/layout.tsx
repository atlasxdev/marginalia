import { MarginNote, Wordmark } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-20">
      <div className="w-full max-w-sm text-center">
        <div className="mb-12 inline-grid justify-items-end">
          <Wordmark className="text-5xl" />
          <MarginNote className="mt-1 mr-6">notes in the margin</MarginNote>
        </div>
        {children}
      </div>
    </main>
  );
}
