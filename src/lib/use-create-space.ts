"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSpace } from "@/app/actions/spaces";

// Creates an untitled space and opens it, ready to be named
export function useCreateSpace() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: createSpace,
    onSuccess: (result) => {
      if (!result.ok || !result.id) return;
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      router.push(`/spaces/${result.id}`);
    },
  });
}
