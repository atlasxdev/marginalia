"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { DicesIcon } from "lucide-react";
import { toast } from "sonner";
import { releasePet, savePet } from "@/app/actions/pet";
import { playPetSound } from "@/lib/pet-sounds";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ACCESSORIES,
  ACCESSORY_LABEL,
  COLORS,
  DEFAULT_LOOK,
  EYES,
  EYES_LABEL,
  NAME_IDEAS,
  SPECIES,
  SPECIES_LABEL,
  type PetLook,
} from "@/lib/pet-art";
import type { Pet } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PetSprite } from "./pet-sprite";

/** "Create your pet": pick a body, colour, eyes and accessory, name it, watch it come alive. */
export function PetBuilder({ open, onOpenChange, pet }: { open: boolean; onOpenChange: (open: boolean) => void; pet: Pet | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border border-glass-border bg-glass-strong sm:max-w-2xl">
        {open && <Builder pet={pet} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Builder({ pet, onDone }: { pet: Pet | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  const [look, setLook] = useState<PetLook>(pet ?? DEFAULT_LOOK);
  const [name, setName] = useState(pet?.name ?? NAME_IDEAS[0]);
  const [bounce, setBounce] = useState(0);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const pick = (change: Partial<PetLook>) => {
    const next = { ...look, ...change };
    setLook(next);
    setBounce((b) => b + 1);
    playPetSound("pet", next.species);
  };

  const save = useMutation({
    mutationFn: () => savePet({ ...look, name }),
    onSuccess: (result) => {
      if (!result.ok) return toast.error(result.message ?? "Couldn't save your pet. Try again.");
      const now = new Date().toISOString();
      queryClient.setQueryData<Pet | null>(["pet"], (p) => ({ ...look, name: name.trim(), fedAt: p?.fedAt ?? now, playedAt: p?.playedAt ?? now, sleptAt: p?.sleptAt ?? now, xp: p?.xp ?? 0 }));
      toast.success(pet ? `${name.trim()} is all set` : `Say hi to ${name.trim()}!`);
      if (!pet) playPetSound("hatch", look.species);
      onDone();
    },
  });
  const release = useMutation({
    mutationFn: releasePet,
    onSuccess: (result) => {
      if (!result.ok) return toast.error(result.message ?? "Couldn't do that. Try again.");
      queryClient.setQueryData(["pet"], null);
      toast.success(`${pet?.name} waved goodbye`);
      onDone();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) save.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>{pet ? `Edit ${pet.name}` : "Create your pet"}</DialogTitle>
        <DialogDescription>It keeps you company in the margin and reacts as you read.</DialogDescription>
      </DialogHeader>

      <div className="mt-5 grid gap-6 sm:grid-cols-[13rem_1fr]">
        {/* Preview */}
        <div className="flex flex-col items-center justify-center rounded-2xl bg-[radial-gradient(80%_60%_at_50%_100%,color-mix(in_srgb,var(--primary)_14%,transparent),transparent)] p-4 ring-1 ring-foreground/10">
          <motion.div
            key={bounce}
            initial={reduced ? false : { scaleY: 0.82, scaleX: 1.1 }}
            animate={{ scaleY: 1, scaleX: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 14 }}
            style={{ originY: 1 }}
          >
            <PetSprite look={look} className="h-[136px] w-32" />
          </motion.div>
          <div className="mt-1 h-1.5 w-24 rounded-[100%] bg-foreground/10" />
          <p className="mt-3 max-w-full truncate font-medium">{name.trim() || "…"}</p>
        </div>

        {/* Choices */}
        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="pet-name">Name</FieldLabel>
            <div className="flex gap-2">
              <Input id="pet-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className="h-10 rounded-xl bg-popover" />
              <Button
                type="button"
                variant="glass"
                size="icon-lg"
                aria-label="Suggest a name"
                onClick={() => setName((n) => NAME_IDEAS.filter((x) => x !== n)[Math.floor(Math.random() * (NAME_IDEAS.length - 1))])}
              >
                <DicesIcon />
              </Button>
            </div>
          </Field>

          <Choice label="Body">
            {SPECIES.map((s) => (
              <Tile key={s} on={look.species === s} label={SPECIES_LABEL[s]} onClick={() => pick({ species: s })}>
                <PetSprite look={{ ...look, species: s }} className="h-[34px] w-8" />
              </Tile>
            ))}
          </Choice>

          <Choice label="Colour">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={look.color === c}
                onClick={() => pick({ color: c })}
                className={cn(
                  "size-8 rounded-full ring-offset-2 ring-offset-background transition-transform duration-150 hover:scale-110 active:scale-95",
                  look.color === c && "ring-2 ring-primary"
                )}
                style={{ background: c }}
              />
            ))}
          </Choice>

          <Choice label="Eyes">
            {EYES.map((e) => (
              <Tile key={e} on={look.eyes === e} label={EYES_LABEL[e]} onClick={() => pick({ eyes: e })} wide>
                <PetSprite look={{ ...look, eyes: e, accessory: "none" }} className="h-[34px] w-8" />
                <span className="text-xs">{EYES_LABEL[e]}</span>
              </Tile>
            ))}
          </Choice>

          <Choice label="Accessory">
            {ACCESSORIES.map((a) => (
              <Tile key={a} on={look.accessory === a} label={ACCESSORY_LABEL[a]} onClick={() => pick({ accessory: a })}>
                <PetSprite look={{ ...look, accessory: a }} className="h-[34px] w-8" />
              </Tile>
            ))}
          </Choice>
        </div>
      </div>

      <DialogFooter className="mt-6 items-center sm:justify-between">
        {pet ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={release.isPending}
            onClick={() => (confirmRelease ? release.mutate() : setConfirmRelease(true))}
          >
            {confirmRelease ? `Yes, say goodbye to ${pet.name}` : `Say goodbye to ${pet.name}`}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={!name.trim() || save.isPending}>
          {pet ? "Save" : `Hatch ${name.trim() || "your pet"}`}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Choice({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Tile({ on, label, onClick, wide, children }: { on: boolean; label: string; onClick: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={onClick}
      className={cn(
        "grid place-items-center gap-1 rounded-xl bg-popover p-1.5 ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 active:scale-95",
        wide ? "w-20" : "size-12",
        on && "ring-2 ring-primary"
      )}
    >
      {children}
    </button>
  );
}
