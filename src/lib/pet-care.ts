import type { Pet } from "./types";

/*
 * The pet's needs, worked out from when it was last looked after, so nothing
 * has to run in the background. Each is 0 to 100 and wears down by the hour.
 */
const HOURS = 3_600_000;
const wear = (since: string, now: number, perHour: number) =>
  Math.round(Math.min(100, Math.max(0, 100 - ((now - new Date(since).getTime()) / HOURS) * perHour)));

export function petStats(pet: Pet, now = Date.now()) {
  const hunger = wear(pet.fedAt, now, 9); // hungry in about 11 hours
  const happy = wear(pet.playedAt, now, 6); // bored in about 16 hours
  const energy = wear(pet.sleptAt, now, 5); // sleepy in about 20 hours
  const level = Math.floor(Math.sqrt(pet.xp / 12)) + 1;
  const nextAt = 12 * level * level;
  const prevAt = 12 * (level - 1) * (level - 1);
  return { hunger, happy, energy, level, progress: (pet.xp - prevAt) / (nextAt - prevAt) };
}

/** A word for how it's doing, its lowest need first. */
export function petMood(pet: Pet, now = Date.now()) {
  const { hunger, happy, energy } = petStats(pet, now);
  if (hunger < 30) return "Hungry";
  if (energy < 30) return "Sleepy";
  if (happy < 30) return "Bored";
  if (hunger > 70 && happy > 70 && energy > 70) return "Happy";
  return "Okay";
}
