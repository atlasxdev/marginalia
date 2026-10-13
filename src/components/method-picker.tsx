"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDownIcon, GraduationCapIcon } from "lucide-react";
import { setStudyMethod } from "@/app/actions/study";
import { meQuery, spaceQuery } from "@/lib/queries";
import { DEFAULT_STUDY_METHOD, STUDY_METHODS, isStudyMethod } from "@/lib/study-methods";
import type { Space, StudyMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Your default study method, for chats outside a subject. */
export function useDefaultMethod(): StudyMethod {
  const preferred = useQuery(meQuery).data?.user_metadata?.study_method;
  return isStudyMethod(preferred) ? preferred : DEFAULT_STUDY_METHOD;
}

/* Picks how your buddy teaches: for one subject when `spaceId` is set,
   otherwise your default. Saved right away. */
export function MethodPicker({ spaceId, className }: { spaceId?: string; className?: string }) {
  const queryClient = useQueryClient();
  const space = useQuery({ ...spaceQuery(spaceId ?? ""), enabled: !!spaceId }).data;
  const fallback = useDefaultMethod();
  const value: StudyMethod = spaceId ? (space?.studyMethod ?? DEFAULT_STUDY_METHOD) : fallback;

  const change = useMutation({
    mutationFn: async (method: StudyMethod) => {
      const result = await setStudyMethod({ method, spaceId });
      if (!result.ok) throw new Error(result.message);
    },
    onMutate: (method) => {
      // Show the new method at once; the save follows
      if (spaceId) queryClient.setQueryData<Space>(spaceQuery(spaceId).queryKey, (s) => s && { ...s, studyMethod: method });
    },
    onSuccess: (_, method) => {
      toast.success(`Your buddy will use ${STUDY_METHODS[method].name}${spaceId && space ? ` in ${space.name}` : ""}.`);
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: spaceId ? ["spaces"] : ["me"] });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="glass" size="sm" className={cn("gap-1.5", className)} aria-label={`Study method: ${STUDY_METHODS[value].name}`}>
          <GraduationCapIcon className="text-primary" />
          {STUDY_METHODS[value].name}
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {spaceId ? "How your buddy teaches in this subject" : "How your buddy teaches"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => isStudyMethod(v) && v !== value && change.mutate(v)}>
          {(Object.keys(STUDY_METHODS) as StudyMethod[]).map((m) => (
            <DropdownMenuRadioItem key={m} value={m} className="items-start py-2">
              <span className="grid gap-0.5">
                <span className="font-medium">{STUDY_METHODS[m].name}</span>
                <span className="text-xs text-muted-foreground">{STUDY_METHODS[m].detail}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
