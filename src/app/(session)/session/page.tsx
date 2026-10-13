import { Suspense } from "react";
import type { Metadata } from "next";
import { SessionView } from "@/components/session/session-view";

export const metadata: Metadata = { title: "Study session" };

export default function SessionPage() {
  return (
    <Suspense>
      <SessionView />
    </Suspense>
  );
}
