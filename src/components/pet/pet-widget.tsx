"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addPetXp } from "@/lib/writes";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { activeExams, useExams } from "@/lib/exams";
import { petLevel, petMood, studyStatus, type StudyStatus } from "@/lib/pet-care";
import { onOpenPet, onPetSignal } from "@/lib/pet-events";
import { petQuery, spacesQuery, studyQuery } from "@/lib/queries";
import { dueCount, rankSubjects, sessionHref } from "@/lib/subjects";
import type { Pet } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { PetBuilder } from "./pet-builder";
import { PetDevice } from "./pet-device";
import { PetSprite, type Face } from "./pet-sprite";

/*
 * Your buddy in the sidebar: a little screen with it, its level and how your
 * studying is going (cards due, or your streak).
 * Tap it to pick up its handheld (a dialog on desktop, a sheet on phones).
 * Before you have a pet, it offers to hatch one. It also hands out XP as you
 * use Marginalia: +5 for an answered question, +3 for an upload, and more for
 * studying: a point per card reviewed and per card right, and one per two
 * minutes of focus.
 */
export function PetWidget({ onOpen }: { onOpen?: () => void }) {
  const pet = useQuery(petQuery);
  const queryClient = useQueryClient();
  const [device, setDevice] = useState(false);
  const [building, setBuilding] = useState(false);
  const [face, setFace] = useState<Face | null>(null);
  const desktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
  const overview = useQuery(studyQuery).data;
  const due = overview ? dueCount(overview.decks) : 0;
  const status = studyStatus(overview, due);
  const spaces = useQuery(spacesQuery).data;
  const pick = overview && spaces ? rankSubjects(spaces, overview.decks, overview.weakTopics)[0]?.space : undefined;
  // Your buddy mentions an event once it's two weeks out
  const exams = useExams();
  const soon = activeExams(exams).find((e) => e.days >= 0 && e.days <= 14);
  const examNote = soon && (soon.days === 0 ? `${soon.exam.name} today!` : `${soon.days}d to ${soon.exam.name}`);

  // "Your pet" in the account menu
  useEffect(() => onOpenPet(() => (queryClient.getQueryData(["pet"]) ? setDevice(true) : setBuilding(true))), [queryClient]);

  // XP, and a flicker of a reaction on the little screen
  useEffect(
    () =>
      onPetSignal((s) => {
        const gain =
          s.kind === "found" ? 5
          : s.kind === "notes" ? 3
          : s.kind === "studied" ? Math.min(s.count, 10) + Math.min(s.right, 10)
          : s.kind === "focused" ? Math.min(Math.round(s.minutes / 2), 30)
          : 0;
        if (gain && queryClient.getQueryData(["pet"])) {
          queryClient.setQueryData<Pet | null>(["pet"], (p) => (p ? { ...p, xp: p.xp + gain } : p));
          void addPetXp(gain);
        }
        const show: Face | null =
          s.kind === "found" || s.kind === "studied" || s.kind === "focused" || s.kind === "notes" ? "happy"
          : s.kind === "shrug" ? "flat"
          : s.kind === "reading" ? "side"
          : null;
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

  const handheld = data && (
    <PetDevice
      pet={data}
      status={status}
      onEdit={() => setBuilding(true)}
      studyLabel={pick?.name}
      onStudy={() => {
        setDevice(false);
        router.push(pick ? sessionHref({ subject: pick.id }) : "/study");
      }}
      onToday={() => {
        setDevice(false);
        router.push("/study");
      }}
    />
  );

  return (
    <>
      <button
        type="button"
        data-tour="buddy"
        onClick={open}
        className="group/pet flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors duration-150 hover:bg-sidebar-accent"
        aria-label={
          data ? `${data.name}: ${petMood(status)}. Open its handheld.` : "Hatch your study buddy"
        }
      >
        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#e7effc] ring-1 ring-foreground/10 dark:bg-[#2b354a]">
          {data ? (
            <PetSprite
              look={data}
              face={face ?? "open"}
              book={face === "side"}
              className="h-[34px] w-8 transition-transform duration-150 group-hover/pet:-translate-y-0.5"
            />
          ) : (
            <EggIcon />
          )}
        </span>
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="truncate text-sm font-medium">{data ? data.name : "Hatch a study buddy"}</span>
          {data ? (
            <Progress pet={data} status={status} examNote={examNote} />
          ) : (
            <span className="truncate text-xs text-muted-foreground">Your study buddy</span>
          )}
        </span>
      </button>

      {data &&
        (desktop ? (
          <Dialog open={device} onOpenChange={setDevice}>
            <DialogContent className="border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[520px]" showCloseButton={false}>
              <DialogTitle className="sr-only">{data.name}</DialogTitle>
              <DialogDescription className="sr-only">Study and focus with your buddy.</DialogDescription>
              {device && handheld}
            </DialogContent>
          </Dialog>
        ) : (
          <Drawer open={device} onOpenChange={setDevice}>
            <DrawerContent className="glass border-glass-border bg-glass-strong pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <DrawerTitle className="sr-only">{data.name}</DrawerTitle>
              <DrawerDescription className="sr-only">Study and focus with your buddy.</DrawerDescription>
              <div className="px-4 pt-2">{device && handheld}</div>
            </DrawerContent>
          </Drawer>
        ))}
      <PetBuilder open={building} onOpenChange={setBuilding} pet={data} />
    </>
  );
}

/** Its level, and the next thing to do: cards due, an exam coming, or your streak. */
function Progress({ pet, status, examNote }: { pet: Pet; status: StudyStatus; examNote?: string }) {
  const { level } = petLevel(pet.xp);
  const note = status.due > 0 ? `${status.due} due` : examNote ? examNote : status.streak > 0 ? `${status.streak}-day streak` : petMood(status);
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="font-semibold text-muted-foreground">Lv {level}</span>
      <span className={cn("truncate", status.due > 0 ? "font-medium text-primary" : "text-muted-foreground")}>{note}</span>
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
