"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const methodSchema = z.object({
  method: z.enum(["recall", "feynman", "socratic", "answer"]),
  spaceId: z.uuid().optional(),
});

const goalSchema = z.union([z.literal(0), z.literal(10), z.literal(20), z.literal(30), z.literal(50)]);

/** Sets how many cards a day you aim for (0 turns the goal off). */
export async function setDailyGoal(goal: number): Promise<ActionState> {
  const parsed = goalSchema.safeParse(goal);
  if (!parsed.success) return { ok: false, message: "Pick a daily goal." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { daily_goal: parsed.data } });
  if (error) return { ok: false, message: "Couldn't save your goal. Try again." };
  return { ok: true };
}

// Sets how your buddy teaches: for one subject, or your default (used by new subjects)
export async function setStudyMethod(input: z.input<typeof methodSchema>): Promise<ActionState> {
  const parsed = methodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick a study method." };
  const { method, spaceId } = parsed.data;
  const supabase = await createClient();

  if (spaceId) {
    const { data, error } = await supabase.from("spaces").update({ study_method: method }).eq("id", spaceId).select("id");
    if (error || !data?.length) return { ok: false, message: "Couldn't change the method. Try again." };
  } else {
    const { error } = await supabase.auth.updateUser({ data: { study_method: method } });
    if (error) return { ok: false, message: "Couldn't change the method. Try again." };
  }
  return { ok: true };
}
