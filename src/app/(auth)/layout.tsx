import { Card } from "@/components/ui/card";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,34rem)]">
      <section className="hidden flex-col justify-between p-12 lg:flex">
        <p className="text-lg font-semibold tracking-tight">Marginalia</p>
        <Card className="max-w-xl -rotate-1 gap-4 px-10 py-9">
          <blockquote className="font-serif text-[1.6rem] leading-[1.45]">
            “Customers may request a full refund{" "}
            <span className="mark" data-active="true">
              within 30 days of purchase
            </span>
            , provided the item is unused.”
          </blockquote>
          <p className="text-sm text-muted-foreground">Refund policy › Eligibility › Time limits</p>
        </Card>
        <p className="max-w-sm text-sm text-muted-foreground">
          Upload your documents, ask questions in plain language, and see the exact passage behind every
          answer.
        </p>
      </section>
      <section className="flex items-center justify-center px-4 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <p className="mb-8 text-lg font-semibold tracking-tight lg:hidden">Marginalia</p>
          <Card className="gap-6 py-8 [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(9)]">
            {children}
          </Card>
        </div>
      </section>
    </main>
  );
}
