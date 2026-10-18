"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeftIcon, DicesIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { queueCards } from "@/lib/auto-cards";
import { COLORS, DEFAULT_LOOK, INK, NAME_IDEAS, SPECIES, SPECIES_LABEL, type PetLook } from "@/lib/pet-art";
import { playPetSound, type PetSound } from "@/lib/pet-sounds";
import { meQuery, petQuery } from "@/lib/queries";
import { ACCEPTED_TYPES } from "@/lib/schemas";
import type { Pet } from "@/lib/types";
import { cn } from "@/lib/utils";
import { finishOnboarding, savePet, saveSpace } from "@/lib/writes";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Wordmark } from "./logo";
import { Bubble, Buddy, Burst } from "./buddy-talk";
import { PetSprite, type Face } from "./pet/pet-sprite";
import { queueTour } from "./tour";
import { uploadFile } from "./upload-form";

const ACCEPT = Object.values(ACCEPTED_TYPES).join(",");

type Step = "hello" | "egg" | "buddy" | "subject" | "notes" | "ready";
const HINT: Record<Step, string> = {
  hello: "",
  egg: "Tap the egg to hatch it. Your buddy runs your study sessions and grows as you learn.",
  buddy: "Pick a name, a body and a colour. You can change these later.",
  subject: "One for each class, like Biology or World History.",
  notes: "Your buddy turns them into flashcards. Answers come only from your notes.",
  ready: "Your flashcards will be ready in a minute. Here's a quick look around while you wait.",
};

const STEPS: { step: Step; title: string }[] = [
  { step: "egg", title: "Hatch your study buddy" },
  { step: "buddy", title: "Make it yours" },
  { step: "subject", title: "Add your first class" },
  { step: "notes", title: "Add your notes" },
];

/* The first-run welcome, its own full-screen page at /welcome. New accounts are sent
   here before anything else loads: a few intro screens, then you hatch your buddy,
   make it yours, name your first class and drop in its notes. Ends inside that
   subject, with a tour of the page. */
export function WelcomeFlow() {
  const me = useQuery(meQuery).data;
  const pet = useQuery(petQuery);
  // Next keeps a page you leave alive, hidden, with its state. Starting over each time you leave
  // means coming back to /welcome shows the first screen, not the last one you saw.
  const [visit, setVisit] = useState(0);
  useEffect(() => () => setVisit((v) => v + 1), []);
  // Waits for your buddy (if you have one) so the screens start with the right look
  if (!me || !pet.isSuccess) return <div className="h-dvh" />;
  return <Welcome key={visit} pet={pet.data ?? null} firstName={(me.user_metadata?.name as string | undefined)?.split(" ")[0]} />;
}

function Welcome({ pet, firstName }: { pet: Pet | null; firstName?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("hello");
  // Which way the last move went, so the next screen slides in from that side
  const [dir, setDir] = useState(1);
  const [slide, setSlide] = useState(0);
  const go = (next: Step, d = 1) => {
    setDir(d);
    setStep(next);
  };
  const [cracking, setCracking] = useState(false);
  const [look, setLook] = useState<PetLook>(pet ?? DEFAULT_LOOK);
  const [name, setName] = useState(pet?.name ?? NAME_IDEAS[0]);
  const [subject, setSubject] = useState("");
  const [spaceId, setSpaceId] = useState<string>();
  const [file, setFile] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Bumped whenever the buddy reacts, to replay its hop
  const [hop, setHop] = useState(0);
  // Confetti, and the step it went off on (so it doesn't go off again on the next one)
  const [burst, setBurst] = useState<{ n: number; at: Step }>({ n: 0, at: "hello" });
  const buddy = name.trim() || "your buddy";

  const react = (sound: PetSound, next = look) => {
    setHop((h) => h + 1);
    playPetSound(sound, next.species);
  };

  const done = async () => {
    queryClient.setQueryData(["me"], (m: unknown) =>
      m && typeof m === "object" ? { ...m, user_metadata: { ...(m as { user_metadata?: object }).user_metadata, onboarded: true } } : m
    );
    await finishOnboarding();
  };

  function hatch() {
    if (cracking) return;
    setCracking(true);
    playPetSound("hatch", look.species);
    setTimeout(() => {
      go("buddy");
      setHop((h) => h + 1);
      setBurst((b) => ({ n: b.n + 1, at: "buddy" }));
    }, reduced ? 0 : 520);
  }

  async function keepBuddy() {
    setBusy(true);
    const result = await savePet({ ...look, name });
    setBusy(false);
    if (!result.ok) return toast.error(result.message ?? "Couldn't save your buddy. Try again.");
    queryClient.setQueryData<Pet | null>(["pet"], (p) => ({ ...look, name: name.trim(), xp: p?.xp ?? 0 }));
    go("subject");
    react("hi");
  }

  async function makeSubject() {
    setBusy(true);
    let result = await saveSpace({ id: spaceId, name: subject, instructions: "", documentIds: [] });
    // Back here after the class was made: rename it, or make it again if it's gone
    if (!result.ok && spaceId) result = await saveSpace({ name: subject, instructions: "", documentIds: [] });
    setBusy(false);
    if (!result.ok || !result.id) return toast.error(result.message ?? "Couldn't make that subject. Try again.");
    setSpaceId(result.id);
    void queryClient.invalidateQueries({ queryKey: ["spaces"] });
    go("notes");
    react("pet");
  }

  async function addNotes(picked: File) {
    if (!spaceId || busy) return;
    setBusy(true);
    setFile(picked.name.replace(/\.[^.]+$/, ""));
    react("notes");
    try {
      const { id } = await uploadFile(picked);
      const result = await saveSpace({ id: spaceId, name: subject, instructions: "", documentIds: [id] });
      if (!result.ok) throw new Error(result.message);
      queueCards([id]);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["spaces"] });
      go("ready");
      react("found");
      setBurst((b) => ({ n: b.n + 1, at: "ready" }));
    } catch (e) {
      setFile(undefined);
      react("shrug");
      toast.error(e instanceof Error && e.message ? e.message : "Couldn't upload that file. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function later() {
    go("ready");
    react("pet");
    setBurst((b) => ({ n: b.n + 1, at: "ready" }));
  }

  async function skip() {
    await done();
    // Skipping setup still gets the walk around, on Today
    queueTour();
    router.replace("/study");
  }

  async function finish() {
    await done();
    // Then a walk around the real page, starting in the new subject
    queueTour();
    router.replace(spaceId ? `/spaces/${spaceId}` : "/study");
  }

  const line: Record<Step, string> = {
    hello: "",
    egg: "Something's wiggling in there. Tap the egg!",
    buddy: pet ? `It's me, ${pet.name}! Want a new look?` : "Hi! I'm your study buddy. Make me yours.",
    subject: `Nice to meet you. I'm ${buddy}. What class are we studying for?`,
    notes: busy && file ? `Ooh, ${file}. Reading it now…` : `Got any notes for ${subject.trim()}? Lecture notes, readings, handouts, anything.`,
    ready: file ? `Got it! I'm making flashcards from ${file}.` : `${subject.trim()} is ready. Add notes whenever you like.`,
  };
  const face: Face = step === "ready" ? "happy" : step === "notes" && busy ? "side" : "open";

  // Before any setup: a few swipeable screens on what Marginalia does
  if (step === "hello") return <Intro firstName={firstName} slide={slide} setSlide={setSlide} onStart={() => go("egg")} onSkip={() => void skip()} />;

  const at = step === "ready" ? STEPS.length : STEPS.findIndex((x) => x.step === step);
  // Where the back arrow goes; none once something's been made that the step before would redo
  const back: Partial<Record<Step, Step>> = { egg: "hello", subject: "buddy", notes: "subject" };

  return (
    <div
      className="relative isolate flex h-dvh flex-col"
      onDragOver={(e) => {
        if (step !== "notes") return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (step !== "notes") return;
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void addNotes(f);
      }}
    >
      <Backdrop color={look.color} />
      {/* Top bar: back, how far along you are, and a way out */}
      <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          disabled={!back[step] || busy}
          onClick={() => back[step] && go(back[step], -1)}
          className={cn("text-muted-foreground", !back[step] && "invisible")}
        >
          <ChevronLeftIcon className="size-6" />
        </Button>
        <div
          className="h-3 flex-1 overflow-hidden rounded-full bg-foreground/10"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={at}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${Math.max(6, (at / STEPS.length) * 100)}%` }}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => void skip()} className={cn("text-muted-foreground", step === "ready" && "invisible")}>
          Skip
        </Button>
      </header>

      {/* The step: your buddy says what's next, you answer below */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <motion.div
          key={step}
          initial={reduced ? false : { opacity: 0, x: 28 * dir }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5 pt-4 pb-8"
        >
          {step === "egg" || step === "ready" ? (
            // The big moments: the buddy (or its egg) takes the screen
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Bubble key={line[step]} text={line[step]} />
              <div className="relative mt-6 grid h-[180px] place-items-end">
                <Burst fire={burst.at === step ? burst.n : 0} color={look.color} />
                {step === "egg" ? (
                  <button type="button" onClick={hatch} aria-label="Hatch the egg" className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Egg color={look.color} cracking={cracking} />
                  </button>
                ) : (
                  <Buddy look={look} face={face} hop={hop} className="h-[180px] w-[170px]" />
                )}
              </div>
              <div className="mt-1 h-2 w-28 rounded-[100%] bg-foreground/15" />
              <h1 className="mt-8 text-3xl leading-tight font-bold tracking-tight">
                {step === "egg" ? "Meet your study buddy" : "You're all set!"}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-sm text-base text-balance">
                {step === "ready" && !file ? "Here's a quick look around your new class." : HINT[step]}
              </p>
            </div>
          ) : (
            <>
              {/* Your buddy beside what it's saying */}
              <div className="flex items-end gap-3">
                <div className="relative grid size-[88px] shrink-0 place-items-end justify-center">
                  <Burst fire={burst.at === step ? burst.n : 0} color={look.color} />
                  <Buddy look={look} face={face} hop={hop} book={step === "notes" && busy} className="h-[84px] w-[79px]" />
                </div>
                <Bubble key={line[step]} text={line[step]} side />
              </div>

              <h1 className="mt-8 text-[26px] leading-tight font-bold tracking-tight">{STEPS[at].title}</h1>
              <p className="text-muted-foreground mt-1.5 text-base">{HINT[step]}</p>

              <div className="mt-7">
                {step === "buddy" && (
                  <form
                    id="onboarding-step"
                    className="grid gap-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (name.trim()) void keepBuddy();
                    }}
                  >
                    <Field>
                      <FieldLabel htmlFor="onboarding-name">Name</FieldLabel>
                      <div className="flex gap-2">
                        <Input id="onboarding-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl bg-popover text-base" />
                        <Button
                          type="button"
                          variant="glass"
                          aria-label="Suggest a name"
                          className="size-12 rounded-xl"
                          onClick={() => {
                            setName((n) => NAME_IDEAS.filter((x) => x !== n)[Math.floor(Math.random() * (NAME_IDEAS.length - 1))]);
                            react("pet");
                          }}
                        >
                          <DicesIcon />
                        </Button>
                      </div>
                    </Field>
                    <div role="group" aria-label="Body">
                      <p className="mb-2 text-sm font-medium">Body</p>
                      <div className="grid grid-cols-4 gap-2">
                        {SPECIES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            aria-pressed={look.species === s}
                            onClick={() => {
                              const next = { ...look, species: s };
                              setLook(next);
                              react("pet", next);
                            }}
                            className={cn(
                              "grid place-items-center gap-1 rounded-2xl bg-popover py-3 text-xs font-medium ring-1 ring-foreground/10 transition-transform duration-150 active:scale-95",
                              look.species === s && "bg-primary/5 ring-2 ring-primary"
                            )}
                          >
                            <PetSprite look={{ ...look, species: s }} className="h-[40px] w-[38px]" />
                            {SPECIES_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div role="group" aria-label="Colour">
                      <p className="mb-2 text-sm font-medium">Colour</p>
                      <div className="grid grid-cols-8 gap-2">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Colour ${c}`}
                            aria-pressed={look.color === c}
                            onClick={() => {
                              const next = { ...look, color: c };
                              setLook(next);
                              react("pet", next);
                            }}
                            className={cn(
                              "aspect-square w-full max-w-10 rounded-full ring-offset-2 ring-offset-background transition-transform duration-150 active:scale-90",
                              look.color === c && "ring-2 ring-primary"
                            )}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </form>
                )}

                {step === "subject" && (
                  <form
                    id="onboarding-step"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (subject.trim()) void makeSubject();
                    }}
                  >
                    <Input
                      id="onboarding-subject"
                      aria-label="Class name"
                      value={subject}
                      maxLength={80}
                      autoFocus
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="For example: Biology"
                      className="h-14 rounded-2xl bg-popover px-4 text-lg"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {CLASS_IDEAS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSubject(c)}
                          className={cn(
                            "rounded-full bg-popover px-3.5 py-1.5 text-sm ring-1 ring-foreground/10 transition-transform duration-150 active:scale-95",
                            subject === c && "bg-primary/5 ring-2 ring-primary"
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </form>
                )}

                {step === "notes" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className={cn(
                      "grid w-full place-items-center gap-2 rounded-2xl border-2 border-dashed border-foreground/15 bg-popover/70 px-4 py-10 text-center transition-colors duration-150 hover:border-primary disabled:pointer-events-none",
                      dragging && "border-primary bg-primary/5"
                    )}
                  >
                    <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                      {busy ? <Spinner className="size-5" /> : <UploadIcon className="size-5" />}
                    </span>
                    <span className="text-base font-semibold">{busy ? "Uploading…" : "Tap to choose a file"}</span>
                    <span className="text-sm text-muted-foreground">PDF, Word or Markdown{!dragging && <span className="hidden sm:inline">, or drop it here</span>}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </main>

      {/* The main button sits at the bottom, where your thumb is */}
      <footer className="border-t border-glass-divider bg-background/80 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto grid w-full max-w-xl gap-2">
          {step === "egg" && (
            <Button size="lg" className="h-12 rounded-2xl text-base" onClick={hatch} disabled={cracking}>
              Hatch
            </Button>
          )}
          {(step === "buddy" || step === "subject") && (
            <Button
              type="submit"
              form="onboarding-step"
              size="lg"
              className="h-12 rounded-2xl text-base"
              disabled={busy || (step === "buddy" ? !name.trim() : !subject.trim())}
            >
              {busy && <Spinner />}
              Continue
            </Button>
          )}
          {step === "notes" && (
            <>
              <Button size="lg" className="h-12 rounded-2xl text-base" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Spinner /> : <UploadIcon />}
                {busy ? "Uploading…" : "Upload notes"}
              </Button>
              <Button variant="ghost" onClick={later} disabled={busy} className="text-muted-foreground">
                I&apos;ll add notes later
              </Button>
            </>
          )}
          {step === "ready" && (
            <Button size="lg" className="h-12 rounded-2xl text-base" onClick={() => void finish()}>
              Show me around
            </Button>
          )}
        </div>
        <Input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) void addNotes(f);
            e.currentTarget.value = "";
          }}
        />
      </footer>
    </div>
  );
}

const CLASS_IDEAS = ["Biology", "Chemistry", "History", "Economics", "Psychology", "Math"];

// Each intro screen has its own colour, drifting behind it
const SLIDE_COLORS = ["#4d9cff", "#8b5cf6", "#f472b6"];

const SLIDES = [
  { title: "Turn your notes into flashcards", body: "Upload a PDF, Word doc or class notes. Marginalia writes the flashcards for you." },
  { title: "Study in short, focused sessions", body: "Flashcards, quick quizzes and typed answers, with breaks built in." },
  { title: "With a buddy who keeps you going", body: "It studies with you, cheers you on, and grows as you learn." },
];

/** The intro: three screens you swipe or tap through, then setup starts. */
function Intro({
  firstName,
  slide,
  setSlide,
  onStart,
  onSkip,
}: {
  firstName?: string;
  slide: number;
  setSlide: (fn: (s: number) => number) => void;
  onStart: () => void;
  onSkip: () => void;
}) {
  const reduced = useReducedMotion();
  const [dir, setDir] = useState(1);
  const last = slide === SLIDES.length - 1;
  const to = (next: number) => {
    if (next < 0 || next >= SLIDES.length) return;
    setDir(next > slide ? 1 : -1);
    setSlide(() => next);
  };

  return (
    <div className="relative isolate flex h-dvh flex-col">
      <Backdrop color={SLIDE_COLORS[slide]} />
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <Wordmark className="text-[22px]" />
        <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
          Skip
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <motion.div
          key={slide}
          drag={reduced ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60) to(slide + 1);
            if (info.offset.x > 60) to(slide - 1);
          }}
          initial={reduced ? false : { opacity: 0, x: 40 * dir }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto flex h-full w-full max-w-xl cursor-grab touch-pan-y flex-col items-center justify-center px-6 text-center active:cursor-grabbing"
        >
          <div className="grid h-[220px] w-full place-items-center sm:h-[260px]" aria-hidden>
            {slide === 0 ? <NotesArt /> : slide === 1 ? <SessionArt /> : <BuddyArt />}
          </div>
          <h1 className="mt-10 max-w-sm text-[28px] leading-tight font-bold tracking-tight text-balance sm:text-3xl">
            {slide === 0 && firstName ? `Hi ${firstName}! ` : ""}
            {SLIDES[slide].title}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-sm text-base text-balance sm:text-lg">{SLIDES[slide].body}</p>
        </motion.div>
      </main>

      <footer className="px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid w-full max-w-xl gap-5">
          <div className="flex justify-center gap-2">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`Screen ${i + 1} of ${SLIDES.length}`}
                aria-current={i === slide}
                onClick={() => to(i)}
                className={cn("h-2 rounded-full transition-all duration-300", i === slide ? "w-6 bg-primary" : "w-2 bg-foreground/20")}
              />
            ))}
          </div>
          <Button size="lg" className="h-12 rounded-2xl text-base" onClick={() => (last ? onStart() : to(slide + 1))}>
            {last ? "Get started" : "Next"}
          </Button>
        </div>
      </footer>
    </div>
  );
}

/** A page of notes that writes itself, then deals out flashcards; the top card flips between question and answer. */
function NotesArt() {
  const reduced = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setFlipped((f) => !f), 2600);
    return () => clearInterval(t);
  }, [reduced]);
  const appear = (delay: number) => (reduced ? {} : { initial: { scaleX: 0 }, animate: { scaleX: 1 }, transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as const } });

  return (
    <div className="relative flex items-center gap-5 sm:gap-8">
      <div className="grid h-44 w-32 content-start gap-2 rounded-xl bg-popover p-4 shadow-md ring-1 ring-foreground/10">
        <motion.span {...appear(0.1)} className="h-2 w-16 origin-left rounded-full bg-foreground/70" />
        {[100, 88, 95, 70, 92, 80, 60].map((w, i) => (
          <motion.span key={i} {...appear(0.2 + i * 0.07)} className="h-1.5 origin-left rounded-full bg-foreground/15" style={{ width: `${w}%` }} />
        ))}
      </div>
      <motion.svg
        viewBox="0 0 24 24"
        className="size-7 shrink-0 text-primary"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={reduced ? undefined : { x: [0, 5, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </motion.svg>
      <div className="relative h-36 w-32 [perspective:600px]">
        {[-10, -3, 4].map((r, i) => (
          <motion.div
            key={r}
            initial={reduced ? false : { x: -150, rotate: 0, opacity: 0, scale: 0.7 }}
            animate={{ x: (i - 1) * 6, rotate: r, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.75 + i * 0.16 }}
            className="absolute inset-0"
          >
            <motion.div
              animate={{ rotateY: i === 2 && flipped ? 180 : 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="relative size-full [transform-style:preserve-3d]"
            >
              <div className="absolute inset-0 grid place-items-center rounded-xl bg-popover p-3 shadow-md ring-1 ring-foreground/10 [backface-visibility:hidden]">
                {i === 2 && <span className="text-center text-sm leading-snug font-semibold">What makes energy for the cell?</span>}
              </div>
              <div className="absolute inset-0 grid place-items-center rounded-xl bg-primary p-3 text-primary-foreground shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <span className="text-center text-base font-bold">Mitochondria</span>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** A focus timer that's actually running, with your buddy reading through it. */
function SessionArt() {
  const reduced = useReducedMotion();
  const [left, setLeft] = useState(18 * 60 + 24);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 25 * 60)), 1000);
    return () => clearInterval(t);
  }, [reduced]);
  const RING = 276;

  return (
    <div className="relative grid size-52 place-items-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" strokeWidth="7" className="stroke-foreground/10" />
        <motion.circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={RING}
          initial={reduced ? false : { strokeDashoffset: RING }}
          animate={{ strokeDashoffset: RING * (1 - left / (25 * 60)) }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="stroke-primary"
        />
      </svg>
      <div className="flex flex-col items-center">
        <PetSprite look={DEFAULT_LOOK} face="side" book className="h-[64px] w-[60px] animate-[pet-read_2.4s_ease-in-out_infinite] motion-reduce:animate-none" />
        <span className="mt-1 text-2xl font-bold tabular-nums">
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

/** Your buddy bouncing, with little pixel hearts floating up. */
function BuddyArt() {
  const reduced = useReducedMotion();
  return (
    <div className="relative">
      {!reduced &&
        [-56, 6, 60].map((x, i) => (
          <motion.svg
            key={x}
            viewBox="0 0 7 6"
            shapeRendering="crispEdges"
            className="absolute bottom-24 left-1/2 size-5"
            initial={{ opacity: 0, y: 0, x }}
            animate={{ opacity: [0, 1, 0], y: -90 }}
            transition={{ duration: 2.2, delay: i * 0.7, repeat: Infinity, ease: "easeOut" }}
            aria-hidden
          >
            <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" fill="#f472b6" />
          </motion.svg>
        ))}
      <Buddy look={DEFAULT_LOOK} face="happy" hop={0} className="h-[170px] w-[160px]" />
    </div>
  );
}

/** Two soft blobs of colour drifting behind a screen. */
function Backdrop({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const drift = (d: number) => (reduced ? {} : { animate: { x: [0, 40 * d, 0], y: [0, 30, 0] }, transition: { duration: 16, repeat: Infinity, ease: "easeInOut" as const } });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        {...drift(1)}
        className="absolute -top-32 -left-24 size-[28rem] rounded-full opacity-30 blur-3xl transition-[background-color] duration-700"
        style={{ backgroundColor: color }}
      />
      <motion.div
        {...drift(-1)}
        className="absolute -right-24 -bottom-40 size-[30rem] rounded-full opacity-20 blur-3xl transition-[background-color] duration-700"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

// Row widths of the pixel egg, top to bottom
const EGG_ROWS = [4, 6, 8, 8, 10, 10, 12, 12, 12, 12, 12, 12, 10, 10, 8, 4];
const EGG_SPOTS: [number, number][] = [[5, 4], [8, 7], [4, 10], [9, 12]];
const CRACK: [number, number][] = [[2, 8], [3, 7], [4, 8], [5, 9], [6, 8], [7, 7], [8, 8], [9, 9], [10, 8], [11, 7]];

/** The egg your buddy hatches from: pixel art like the buddy, wobbling until tapped. */
function Egg({ color, cracking }: { color: string; cracking: boolean }) {
  const [shake, setShake] = useState(false);
  // Gives a little wobble every couple of seconds, so it reads as tappable
  useEffect(() => {
    if (cracking) return;
    const t = setInterval(() => {
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }, 2200);
    return () => clearInterval(t);
  }, [cracking]);

  return (
    <svg
      viewBox="0 0 14 16"
      shapeRendering="crispEdges"
      className={cn(
        "h-[160px] w-[140px] origin-bottom md:h-[220px] md:w-[192px] transition-transform duration-150 hover:scale-105",
        shake && "animate-[egg-wobble_600ms_ease-in-out] motion-reduce:animate-none",
        cracking && "animate-[pet-squash_300ms_ease-out_2] motion-reduce:animate-none"
      )}
      aria-hidden
    >
      {EGG_ROWS.map((w, y) => {
        const x = (14 - w) / 2;
        const edge = y === 0 || y === EGG_ROWS.length - 1;
        return (
          <g key={y}>
            <rect x={x} y={y} width={w} height={1} fill={INK} />
            {!edge && <rect x={x + 1} y={y} width={w - 2} height={1} fill="#fbf7ee" />}
          </g>
        );
      })}
      {EGG_SPOTS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={2} height={1} fill={color} />
      ))}
      {cracking && CRACK.map(([x, y]) => <rect key={`c${x}-${y}`} x={x} y={y} width={1} height={1} fill={INK} />)}
    </svg>
  );
}
