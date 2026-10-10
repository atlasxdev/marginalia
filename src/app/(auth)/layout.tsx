export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,34rem)]">
      <section className="hidden flex-col justify-between border-r border-rule p-12 lg:flex">
        <p className="text-lg font-semibold tracking-tight">Marginalia</p>
        <blockquote className="max-w-xl font-serif text-[1.75rem] leading-[1.45]">
          “Customers may request a full refund{" "}
          <span className="mark" data-active="true">within 30 days of purchase</span>, provided the
          item is unused.”
          <footer className="mt-5 font-sans text-sm text-ink-soft">
            Refund policy › Eligibility › Time limits
          </footer>
        </blockquote>
        <p className="max-w-sm text-sm text-ink-soft">
          Upload your documents, ask questions in plain language, and see the exact passage behind
          every answer.
        </p>
      </section>
      <section className="flex items-center justify-center px-4 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <p className="mb-10 text-lg font-semibold tracking-tight lg:hidden">Marginalia</p>
          {children}
        </div>
      </section>
    </main>
  );
}
