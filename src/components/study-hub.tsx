"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon, LayersIcon, PlayIcon, PlusIcon, SparklesIcon, TargetIcon } from "lucide-react";
import { streakFrom } from "@/lib/pet-care";
import { documentsQuery, meQuery, petQuery, spacesQuery, studyQuery } from "@/lib/queries";
import { cardCounts, dueCount, sessionHref, subjectDecks, topicsIn, waitingLine } from "@/lib/subjects";
import type { DocumentItem, Space, StudyOverview, WeakTopic } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Composer } from "./composer";
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
  const { decks, weakTopics, week, activity } = overview;
  const due = dueCount(decks);
  const streak = streakFrom(activity);
  // Reviewers that aren't in any subject yet, like ones from a general chat
  const loose = decks.filter((d) => !spaces.some((s) => subjectDecks([d], s).length));

  const greeting =
    spaces.length === 0
      ? "Let's set up your first subject. Add your notes and I'll help you study them."
      : due
        ? `${waitingLine(cardCounts(decks))} today. Let's get through them together.`
        : weakTopics[0]
          ? `You're all caught up. ${weakTopics[0].topic} could use another go.`
          : "You're all caught up. Nice work.";

  return (
    <>
      <div className="flex items-center gap-4">
        {pet && (
          <span className="grid size-16 shrink-0 place-items-end justify-center overflow-hidden rounded-2xl bg-[#e7effc] pb-1.5 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
            <PetSprite look={pet} face={due ? "side" : "happy"} book={!!due} className="h-[50px] w-12" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{name ? `Hi, ${name.split(" ")[0]}` : "Today"}</h1>
          <p className="mt-1 text-muted-foreground">
            {pet && <span className="font-medium text-foreground">{pet.name}: </span>}
            {greeting}
          </p>
        </div>
      </div>

      {spaces.length === 0 ? (
        <Empty className={`${groupClass} mt-10`}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayersIcon />
            </EmptyMedia>
            <EmptyTitle>What are you studying?</EmptyTitle>
            <EmptyDescription>
              Make a subject for each class, like Biology or World History, and add its notes. Everything starts there: asking questions, reviewers, and study sessions.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="lg" onClick={() => setCreating(true)}>
              <PlusIcon />
              Add your first subject
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {due > 0 && (
            <div className="mt-6">
              <Button size="lg" asChild>
                <Link href={sessionHref({})}>
                  <PlayIcon />
                  Study all subjects ({due} cards)
                </Link>
              </Button>
            </div>
          )}

          <section aria-labelledby="subjects" className="mt-10">
            <div className="flex items-center justify-between gap-3">
              <h2 id="subjects" className="text-xl font-semibold">
                Your subjects
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
                <PlusIcon />
                New subject
              </Button>
            </div>
            <ItemGroup className={`${groupClass} mt-4 gap-0`}>
              {spaces.map((s, i) => (
                <Fragment key={s.id}>
                  {i > 0 && <ItemSeparator className="my-0 bg-glass-divider" />}
                  <SubjectRow space={s} overview={overview} documents={documents} />
                </Fragment>
              ))}
            </ItemGroup>
          </section>
        </>
      )}

      {decks.length > 0 && (
        <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Streak" value={streak ? `${streak} ${streak === 1 ? "day" : "days"}` : "Start today"} />
          <Stat label="Cards this week" value={String(week.reviewed)} />
          <Stat label="Right this week" value={week.accuracy === null ? "None yet" : `${Math.round(week.accuracy * 100)}%`} />
          <Stat label="Focus this week" value={week.focusMinutes ? minutes(week.focusMinutes) : "None yet"} />
        </dl>
      )}

      {weakTopics.length > 0 && (
        <section aria-labelledby="weak-topics" className="mt-14">
          <h2 id="weak-topics" className="text-xl font-semibold">
            Needs work
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Topics you&apos;ve been missing lately, weakest first.</p>
          <WeakTopicList topics={weakTopics} />
        </section>
      )}

      {documents.length > 0 && (
        <section aria-labelledby="ask-all" className="mt-14">
          <h2 id="ask-all" className="text-xl font-semibold">
            Ask all your notes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Searches every subject. To stay within one class, ask from its subject page.</p>
          <div className="mt-4">
            <Composer placeholder="Ask anything from your notes" className="max-w-none" />
          </div>
        </section>
      )}

      {loose.length > 0 && (
        <section aria-labelledby="loose-decks" className="mt-14">
          <h2 id="loose-decks" className="text-xl font-semibold">
            Other reviewers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Made outside a subject.</p>
          <div className="mt-4">
            <DeckList decks={loose} />
          </div>
        </section>
      )}

      <SpaceDialog open={creating} onOpenChange={setCreating} onSaved={(id) => router.push(`/spaces/${id}`)} />
    </>
  );
}

/** A subject and the one thing it needs next. */
function SubjectRow({ space, overview, documents }: { space: Space; overview: StudyOverview; documents: DocumentItem[] }) {
  const makeDeck = useMakeDeck();
  const decks = subjectDecks(overview.decks, space);
  const due = dueCount(decks);
  const weak = topicsIn(overview.weakTopics, decks)[0];
  const files = documents.filter((d) => space.documentIds.includes(d.id));
  const readyFiles = files.filter((d) => d.status === "ready").length;
  const cards = decks.reduce((n, d) => n + d.payload.cards.length, 0);

  const status =
    files.length === 0
      ? "No notes yet"
      : decks.length === 0
        ? `${files.length} ${files.length === 1 ? "file" : "files"}, no reviewer yet`
        : [due ? waitingLine(cardCounts(decks)) : "All caught up", weak && `${weak.topic} is weak`].filter(Boolean).join(", ");

  return (
    <Item className="flex-wrap gap-y-3 px-5 py-4">
      <ItemContent className="min-w-40">
        <ItemTitle className="text-[15px]">
          <Link href={`/spaces/${space.id}`} className="hover:underline">
            {space.name}
          </Link>
        </ItemTitle>
        <ItemDescription>
          {status}
          {cards > 0 && <span className="text-muted-foreground/70">{` (${cards} cards)`}</span>}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {files.length === 0 ? (
          <Button variant="outline" asChild>
            <Link href={`/spaces/${space.id}`}>
              <PlusIcon />
              Add notes
            </Link>
          </Button>
        ) : decks.length === 0 ? (
          <Button
            variant="outline"
            disabled={readyFiles === 0 || makeDeck.isPending}
            onClick={() => makeDeck.mutate({ body: { spaceId: space.id }, name: space.name })}
          >
            <SparklesIcon />
            Make a reviewer
          </Button>
        ) : (
          <Button variant={due ? "default" : "outline"} asChild>
            <Link href={sessionHref({ subject: space.id })}>
              <PlayIcon />
              {due ? "Study" : "Practice"}
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="icon" asChild aria-label={`Open ${space.name}`} className="text-muted-foreground">
          <Link href={`/spaces/${space.id}`}>
            <ChevronRightIcon />
          </Link>
        </Button>
      </ItemActions>
    </Item>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${groupClass} px-4 py-3`}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}

/** Weak topics, each with a session on just that topic. */
export function WeakTopicList({ topics, subjectId }: { topics: WeakTopic[]; subjectId?: string }) {
  return (
    <ItemGroup className={`${groupClass} mt-4 gap-0`}>
      {topics.map((t, i) => (
        <div key={t.topic}>
          {i > 0 && <ItemSeparator className="my-0 bg-glass-divider" />}
          <Item className="flex-wrap gap-y-3 px-5 py-4">
            <ItemContent className="min-w-40">
              <ItemTitle className="text-[15px]">{t.topic}</ItemTitle>
              <ItemDescription>
                {Math.round(t.score * 100)}% right in your last {t.attempts} tries
              </ItemDescription>
              <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(t.score * 100, 4)}%` }} />
              </div>
            </ItemContent>
            <ItemActions>
              <Button variant="outline" asChild>
                <Link href={sessionHref({ topic: t.topic, subject: subjectId })}>
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
