import type { Metadata } from "next";
import { Providers } from "@/components/providers";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Study sessions are full screen: no sidebar, just you, your buddy and the cards
export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
