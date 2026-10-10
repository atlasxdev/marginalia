import { AppIcon } from "@/components/app-icon";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <AppIcon className="mx-auto mb-6 size-16" />
        {children}
      </div>
    </main>
  );
}
