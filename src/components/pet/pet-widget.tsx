"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addPetXp } from "@/app/actions/pet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { petMood, petStats } from "@/lib/pet-care";
import { onOpenPet, onPetSignal } from "@/lib/pet-events";
import { petQuery } from "@/lib/queries";
import type { Pet } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { PetBuilder } from "./pet-builder";
import { PetDevice } from "./pet-device";
import { PetSprite, type Face } from "./pet-sprite";

/*
 * Your pet in the sidebar: a little screen with it, its mood and its needs.
 * Tap it to pick up its handheld (a dialog on desktop, a sheet on phones).
 * Before you have a pet, it offers to hatch one. It also hands out XP as you
 * use Marginalia: +5 for an answered question, +3 for an upload.
 */
export function PetWidget({ onOpen }: { onOpen?: () => void }) {
  const pet = useQuery(petQuery);
  const queryClient = useQueryClient();
  const [device, setDevice] = useState(false);
  const [building, setBuilding] = useState(false);
  const [face, setFace] = useState<Face | null>(null);
  const desktop = useMediaQuery("(min-width: 768px)");

  // "Your pet" in the account menu
  useEffect(() => onOpenPet(() => (queryClient.getQueryData(["pet"]) ? setDevice(true) : setBuilding(true))), [queryClient]);

  // XP, and a flicker of a reaction on the little screen
  useEffect(
    () =>
      onPetSignal((s) => {
        const gain = s.kind === "found" ? 5 : s.kind === "eat" ? 3 : 0;
        if (gain && queryClient.getQueryData(["pet"])) {
          queryClient.setQueryData<Pet | null>(["pet"], (p) => (p ? { ...p, xp: p.xp + gain } : p));
          void addPetXp(gain);
        }
        const show: Face | null = s.kind === "found" ? "happy" : s.kind === "shrug" ? "flat" : s.kind === "eat" ? "chomp" : s.kind === "reading" ? "side" : null;
        setFace(show);
        if (s.kind !== "reading") setTimeout(() => setFace(null), 1600);
      }),
    [queryClient]
  );

  if (!pet.isSuccess) return null;
  const data = pet.data;

  const open = () => {
    onOpen?.();
    if (data) setDevice(true);
    else setBuilding(true);
  };

  const handheld = data && <PetDevice pet={data} onEdit={() => setBuilding(true)} />;

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="group/pet flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors duration-150 hover:bg-sidebar-accent"
        aria-label={data ? `${data.name}: ${petMood(data)}. Open its handheld.` : "Hatch a pet"}
      >
        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#e7effc] ring-1 ring-foreground/10 dark:bg-[#2b354a]">
          {data ? (
            <PetSprite look={data} face={face ?? "open"} book={face === "side"} className="h-[34px] w-8 transition-transform duration-150 group-hover/pet:-translate-y-0.5" />
          ) : (
            <EggIcon />
          )}
        </span>
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="truncate text-sm font-medium">{data ? data.name : "Hatch a pet"}</span>
          {data ? <Needs pet={data} /> : <span className="truncate text-xs text-muted-foreground">A little friend for your reading</span>}
        </span>
      </button>

      {data &&
        (desktop ? (
          <Dialog open={device} onOpenChange={setDevice}>
            <DialogContent className="border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[520px]" showCloseButton={false}>
              <DialogTitle className="sr-only">{data.name}</DialogTitle>
              <DialogDescription className="sr-only">Feed, play with and look after your pet.</DialogDescription>
              {device && handheld}
            </DialogContent>
          </Dialog>
        ) : (
          <Drawer open={device} onOpenChange={setDevice}>
            <DrawerContent className="glass border-glass-border bg-glass-strong pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <DrawerTitle className="sr-only">{data.name}</DrawerTitle>
              <DrawerDescription className="sr-only">Feed, play with and look after your pet.</DrawerDescription>
              <div className="px-4 pt-2">{device && handheld}</div>
            </DrawerContent>
          </Drawer>
        ))}
      <PetBuilder open={building} onOpenChange={setBuilding} pet={data} />
    </>
  );
}

/** Three tiny bars: hunger, happiness, energy. */
function Needs({ pet }: { pet: Pet }) {
  const { hunger, happy, energy, level } = petStats(pet);
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold text-muted-foreground">Lv {level}</span>
      {(
        [
          ["Hunger", hunger],
          ["Happy", happy],
          ["Energy", energy],
        ] as const
      ).map(([label, v]) => (
        <span key={label} title={`${label} ${v}%`} className="h-1.5 w-6 overflow-hidden rounded-full bg-foreground/10">
          <span className={cn("block h-full rounded-full", v < 30 ? "bg-destructive" : v < 60 ? "bg-amber-500" : "bg-success")} style={{ width: `${v}%` }} />
        </span>
      ))}
    </span>
  );
}

function EggIcon() {
  return (
    <svg viewBox="0 0 10 12" shapeRendering="crispEdges" className="h-8 w-7 animate-[egg-wobble_5s_ease-in-out_infinite] motion-reduce:animate-none" aria-hidden>
      {["...OOOO...", "..OCCCCO..", ".OCCCCCCO.", ".OCCSCCCO.", "OCCCCCCSCO", "OCSCCCCCCO", "OCCCCSCCCO", "OCCCCCCCCO", "OCSCCCCSCO", ".OCCCCCCO.", "..OCCCCO..", "...OOOO..."].flatMap((row, y) =>
        [...row].map((ch, x) => (ch === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={ch === "O" ? "#64748b" : ch === "S" ? "#4d9cff" : "#fdf8ec"} />))
      )}
    </svg>
  );
}
