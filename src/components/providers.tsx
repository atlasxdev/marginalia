"use client";

import type { ReactNode } from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { MotionConfig } from "motion/react";

let browserQueryClient: QueryClient | undefined;

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
    // A request that fails outright (offline, server error) says so instead of failing silently
    mutationCache: new MutationCache({
      onError: (_error, _vars, _ctx, mutation) => {
        if (!mutation.options.onError) toast.error("Something went wrong. Check your connection and try again.");
      },
    }),
  });
}

function getQueryClient() {
  // Keep server requests isolated and preserve the browser cache across renders.
  if (typeof window === "undefined") return makeClient();
  browserQueryClient ??= makeClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  // Motion settles to its end state when the visitor prefers reduced motion
  return (
    <QueryClientProvider client={getQueryClient()}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </QueryClientProvider>
  );
}
