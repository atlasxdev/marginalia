"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, PlayIcon, PlusIcon, SparklesIcon, TargetIcon } from "lucide-react";
import { streakFrom } from "@/lib/pet-care";
import { useCardQueue } from "@/lib/auto-cards";
import { documentsQuery, meQuery, petQuery, spacesQuery, studyQuery } from "@/lib/queries";
import { cardCounts, dueCount, rankSubjects, sessionHref, subjectDecks, topicsIn, waitingLine } from "@/lib/subjects";
import type { DocumentItem, Pet, Space, StudyOverview, WeakTopic } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { DeckList, useMakeDeck } from "./deck";
import { PetSprite } from "./pet/pet-sprite";
import { SpaceDialog } from "./space-dialog";

const groupClass = "glass rounded-xl border border-glass-border bg-glass";

function minutes(total: number) {
  if (total < 60) return `${total}m`;
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

/* Today: where you start. Your subjects with what each needs next, a session
   across everything that's due, your week, and a box to ask all your notes. */
export function StudyHub() {
  const hydrated = useHydrated();
  const study = useQuery(studyQuery);
  const spaces = useQuery(spacesQuery);
  const documents = useQuery(documentsQuery);
  const ready = hydrated && study.data && spaces.data && documents.data;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 pt-14 pb-24 sm:px-8 lg:px-12">
        {ready ? <Today overview={study.data!} spaces={spaces.data!} documents={documents.data!} /> : <TodaySkeleton />}
      </div>
    </div>
  );
}

function Today({ overview, spaces, documents }: { overview: StudyOverview; spaces: Space[]; documents: DocumentItem[] }) {
  const router = useRouter();
  const pet = useQuery(petQuery).data;
  const name = useQuery(meQuery).data?.user_metadata?.name as string | undefined;
  const [creating, setCreating] = useState(false);
  const [hour] = useState(() => new Date().getHours());
  const { decks, weakTopics, week, activity } = overview;
  const due = dueCount(decks);
  const streak = streakFrom(activity);
  // Flashcards that aren't in any subject yet, like ones from a general chat
  const loose = decks.filter((d) => !spaces.some((s) => subjectDecks([d], s).length));

  // Today's pick: the subject with reviews due first, then weak topics, then new cards
  const ranked = rankSubjects(spaces, decks, weakTopics);
  const pick = ranked[0];
  const first = name?.split(" ")[0];
  const hello = `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}${first ? `, ${first}` : ""}`;
  const plan = pick
    ? [waitingLine(pick.counts), pick.weak[0] && `${pick.weak[0].topic} needs work`].filter(Boolean).join(", and ")
    : null;

  return (
    <>
      {/* Hero: your buddy, today's pick, your week */}
      <section aria-labelledby="today-title" className={`${groupClass} rounded-2xl p-6 sm:p-8`}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {pet && (
            <span className="grid h-24 w-28 shrink-0 place-items-end justify-center overflow-hidden rounded-[22px] bg-[#e7effc] pb-3 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
              <PetSprite look={pet} face={due ? "side" : "happy"} book={!!due} className="h-16 w-[60px] animate-[pet-read_2.4s_ease-in-out_infinite] motion-reduce:animate-none" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 id="today-title" className="text-3xl font-bold tracking-tight">
              {hello}
            </h1>
            <p className="mt-1.5 text-lg text-muted-foreground text-balance">
              {spaces.length === 0 || (decks.length === 0 && activity.length === 0)
                ? "Let's get you set up. Three steps and we're studying."
                : pick
                  ? `${pet?.name ?? "Your buddy"} suggests ${pick.space.name}: ${plan}.`
                  : "You're all caught up. Nice work."}
            </p>
          </div>
          {pick && (
            <div className="flex shrink-0 flex-col gap-2">
              <Button size="lg" asChild className="h-12 px-6 text-base">
                <Link href={sessionHref({ subject: pick.space.id })}>
                  <PlayIcon />
                  Start with {pick.space.name}
                </Link>
              </Button>
              {ranked.length > 1 && due > 0 && (
                <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                  <Link href={sessionHref({})}>Or study everything ({due})</Link>
                </Button>
              )}
            </div>
          )}
        </div>

        {decks.length > 0 && (
          <dl className="mt-6 grid grid-cols-2 gap-y-4 border-t border-glass-divider pt-5 sm:grid-cols-4">
            {[
              ["Streak", streak ? `${streak} ${streak === 1 ? "day" : "days"}` : "Start today"],
              ["Cards this week", String(week.reviewed)],
              ["Right this week", week.accuracy === null ? "None yet" : `${Math.round(week.accuracy * 100)}%`],
              ["Focus this week", week.focusMinutes ? minutes(week.focusMinutes) : "None yet"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* Until the first session, three steps show the way */}
      {activity.length === 0 && <GettingStarted spaces={spaces} decks={decks} documents={documents} pet={pet} onCreate={() => setCreating(true)} />}

      {spaces.length > 0 && (
        <section aria-labelledby="subjects" className="mt-12">
          <div className="flex items-center justify-between gap-3">
            <h2 id="subjects" className="text-xl font-semibold">
              Your subjects
            </h2>
            <Button variant="glass" size="sm" onClick={() => setCreating(true)}>
              <PlusIcon />
              New subject
            </Button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((s) => (
              <SubjectCard key={s.id} space={s} overview={overview} documents={documents} />
            ))}
          </div>
        </section>
      )}

      {weakTopics.length > 0 && (
        <section aria-labelledby="weak-topics" className="mt-12">
          <h2 id="weak-topics" className="text-xl font-semibold">
            Needs work
          </h2>
          <WeakTopicList
            topics={weakTopics.slice(0, 3)}
            subjectOf={(t) => spaces.find((s) => topicsIn([t], subjectDecks(decks, s)).length)}
          />
        </section>
      )}

      {loose.length > 0 && (
        <section aria-labelledby="loose-decks" className="mt-12">
          <h2 id="loose-decks" className="text-xl font-semibold">
            Not in a subject
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Flashcards from files or chats outside your subjects.</p>
          <div className="mt-4">
            <DeckList decks={loose} />
          </div>
        </section>
      )}

      <SpaceDialog open={creating} onOpenChange={setCreating} onSaved={(id) => router.push(`/spaces/${id}`)} />
    </>
  );
}

/** A subject as a card: its progress, and the one thing it needs next. */
function SubjectCard({ space, overview, documents }: { space: Space; overview: StudyOverview; documents: DocumentItem[] }) {
  const makeDeck = useMakeDeck();
  const queue = useCardQueue();
  const decks = subjectDecks(overview.decks, space);
  const counts = cardCounts(decks);
  const weak = topicsIn(overview.weakTopics, decks)[0];
  const files = documents.filter((d) => space.documentIds.includes(d.id));
  const readyFiles = files.filter((d) => d.status === "ready").length;
  const cards = decks.reduce((n, d) => n + d.payload.cards.length, 0);
  const learned = Math.max(0, cards - counts.review - counts.fresh);
  const preparing = files.some((d) => queue.includes(d.id) || d.status === "pending" || d.status === "processing");

  const status =
    files.length === 0
      ? "No notes yet"
      : decks.length === 0
        ? preparing
          ? "Making flashcards…"
          : "No flashcards yet"
        : counts.review || counts.fresh
          ? waitingLine(counts)
          : "All caught up";

  return (
    <div className={`${groupClass} group/card relative flex min-h-44 flex-col rounded-2xl p-5 transition-colors duration-150 hover:bg-glass-strong`}>
      <Link href={`/spaces/${space.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Open ${space.name}`} />
      <p className="truncate text-lg font-semibold">{space.name}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {files.length} {files.length === 1 ? "file" : "files"}
        {cards > 0 && `, ${cards} cards`}
      </p>
      {cards > 0 && (
        <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-label={`${learned} of ${cards} learned`}>
          <div className="bg-success" style={{ width: `${(learned / cards) * 100}%` }} />
          <div className="bg-primary" style={{ width: `${(counts.review / cards) * 100}%` }} />
        </div>
      )}
      <p className="mt-3 text-sm">
        {status}
        {weak && <span className="text-muted-foreground">. {weak.topic} is weak</span>}
      </p>
      <div className="relative mt-auto pt-4">
        {files.length === 0 ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/spaces/${space.id}`}>
              <PlusIcon />
              Add notes
            </Link>
          </Button>
        ) : decks.length === 0 ? (
          <Button
            variant="outline"
            size="sm"
            disabled={preparing || readyFiles === 0 || makeDeck.isPending}
            onClick={() => makeDeck.mutate({ body: { spaceId: space.id }, name: space.name })}
          >
            {preparing ? <Spinner /> : <SparklesIcon />}
            {preparing ? "Making flashcards…" : "Make flashcards"}
          </Button>
        ) : (
          <Button variant={counts.review ? "default" : "outline"} size="sm" asChild>
            <Link href={sessionHref({ subject: space.id })}>
              <PlayIcon />
              {counts.review || counts.fresh ? "Study" : "Practice"}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/** The way in: make a subject, add its notes, study. Each step ticks off as it's done. */
function GettingStarted({
  spaces,
  decks,
  documents,
  pet,
  onCreate,
}: {
  spaces: Space[];
  decks: StudyOverview["decks"];
  documents: DocumentItem[];
  pet: Pet | null | undefined;
  onCreate: () => void;
}) {
  const queue = useCardQueue();
  const withNotes = spaces.find((s) => s.documentIds.length > 0);
  const withCards = spaces.find((s) => subjectDecks(decks, s).length > 0);
  const preparing = documents.some((d) => queue.includes(d.id) || d.status === "pending" || d.status === "processing");
  const buddy = pet?.name ?? "your buddy";

  const steps = [
    {
      title: "Add a subject",
      detail: "One for each class, like Biology or World History.",
      done: spaces.length > 0,
      action: (
        <Button onClick={onCreate}>
          <PlusIcon />
          Add a subject
        </Button>
      ),
    },
    {
      title: "Add your notes",
      detail: `Upload lecture notes, readings or handouts. ${buddy} turns them into flashcards.`,
      done: !!withNotes,
      action: spaces[0] && (
        <Button asChild>
          <Link href={`/spaces/${spaces[0].id}`}>
            <PlusIcon />
            Add notes to {spaces[0].name}
          </Link>
        </Button>
      ),
    },
    {
      title: `Study with ${buddy}`,
      detail: "A focus session: flashcards, quick quizzes and typed answers, with breaks.",
      done: false,
      action: withCards ? (
        <Button asChild>
          <Link href={sessionHref({ subject: withCards.id })}>
            <PlayIcon />
            Study {withCards.name}
          </Link>
        </Button>
      ) : preparing ? (
        <Button disabled>
          <Spinner />
          Making your flashcards…
        </Button>
      ) : (
        withNotes && (
          <Button asChild>
            <Link href={`/spaces/${withNotes.id}`}>Open {withNotes.name}</Link>
          </Button>
        )
      ),
    },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <section aria-labelledby="getting-started" className={`${groupClass} mt-8 p-6`}>
      <h2 id="getting-started" className="text-xl font-semibold">
        Get started in three steps
      </h2>
      <ol className="mt-5 grid gap-5">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold",
                step.done ? "bg-success text-white" : i === current ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-muted-foreground"
              )}
            >
              {step.done ? <CheckIcon className="size-4" /> : i + 1}
            </span>
            <div className="grid min-w-0 flex-1 gap-1">
              <p className={cn("font-medium", step.done && "text-muted-foreground line-through", i > current && "text-muted-foreground")}>{step.title}</p>
              {i === current && (
                <>
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                  {step.action && <div className="mt-2">{step.action}</div>}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Weak topics, each with a session on just that topic. */
export function WeakTopicList({ topics, subjectId, subjectOf }: { topics: WeakTopic[]; subjectId?: string; subjectOf?: (t: WeakTopic) => Space | undefined }) {
  return (
    <ItemGroup className={`${groupClass} mt-4 gap-0`}>
      {topics.map((t, i) => (
        <div key={t.topic}>
          {i > 0 && <ItemSeparator className="my-0 bg-glass-divider" />}
          <Item className="flex-wrap gap-y-3 px-5 py-4">
            <ItemContent className="min-w-40">
              <ItemTitle className="text-[15px]">{t.topic}</ItemTitle>
              <ItemDescription>
                {subjectOf?.(t) && <span className="font-medium text-foreground/80">{subjectOf(t)!.name}: </span>}
                {Math.round(t.score * 100)}% right in your last {t.attempts} tries
              </ItemDescription>
              <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(t.score * 100, 4)}%` }} />
              </div>
            </ItemContent>
            <ItemActions>
              <Button variant="outline" asChild>
                <Link href={sessionHref({ topic: t.topic, subject: subjectId ?? subjectOf?.(t)?.id })}>
                  <TargetIcon />
                  Practice
                </Link>
              </Button>
            </ItemActions>
          </Item>
        </div>
      ))}
    </ItemGroup>
  );
}

function TodaySkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-2xl" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <Skeleton className="mt-10 h-40 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}
