"use client";

import { useQuery } from "@tanstack/react-query";
import { GalleryVerticalEndIcon, PenLineIcon } from "lucide-react";
import { isDue } from "@/lib/leitner";
import { meQuery, petQuery, studyQuery } from "@/lib/queries";
import type { StudyOverview, WeakTopic } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { DeckList, MakeDeckButton } from "./deck";
import { PetSprite } from "./pet/pet-sprite";
import { useStudySession } from "./study";

const groupClass = "glass rounded-xl border border-glass-border bg-glass";

/** Days in a row you've studied, counting today or, if you haven't yet, yesterday. */
function streakFrom(activity: string[]) {
  const day = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days = new Set(activity.map((t) => day(new Date(t))));
  const cursor = new Date();
  if (!days.has(day(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(day(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function minutes(total: number) {
  if (total < 60) return `${total}m`;
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

export function StudyHub() {
  const hydrated = useHydrated();
  const query = useQuery(studyQuery);
  const overview = hydrated ? query.data : undefined;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 pt-14 pb-24 sm:px-8 lg:px-12">
        {overview ? <Hub overview={overview} /> : <HubSkeleton />}
      </div>
    </div>
  );
}

function Hub({ overview }: { overview: StudyOverview }) {
  const { decks, weakTopics, week, activity } = overview;
  const session = useStudySession(decks);
  const pet = useQuery(petQuery).data;
  const name = useQuery(meQuery).data?.user_metadata?.name as string | undefined;
  const due = session.dueItems().length;
  const streak = streakFrom(activity);

  const greeting =
    decks.length === 0
      ? "Make a reviewer from your notes and we'll study it together."
      : weakTopics[0]
        ? `You've been missing ${weakTopics[0].topic}. Want to go over it?`
        : due
          ? `You have ${due} ${due === 1 ? "card" : "cards"} to review. Let's do it.`
          : "You're all caught up. Nice work.";

  return (
    <>
      {/* Your buddy, with what to do next */}
      <div className="flex items-center gap-4">
        {pet && (
          <span className="grid size-16 shrink-0 place-items-end justify-center overflow-hidden rounded-2xl bg-[#e7effc] pb-1.5 ring-1 ring-foreground/10 dark:bg-[#2b354a]">
            <PetSprite look={pet} face={due ? "side" : "happy"} book={!!due} className="h-[50px] w-12" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{name ? `Hi, ${name.split(" ")[0]}` : "Study"}</h1>
          <p className="mt-1 text-muted-foreground">
            {pet && <span className="font-medium text-foreground">{pet.name}: </span>}
            {greeting}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {due > 0 && (
          <Button size="lg" onClick={() => session.start("cards", "Due today", (item) => isDue(item.progress))}>
            <GalleryVerticalEndIcon />
            Review {due} due
          </Button>
        )}
        <MakeDeckButton variant={due > 0 ? "glass" : "default"} />
      </div>

      {/* This week */}
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
            Study these next
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Topics you&apos;ve been missing lately, weakest first.</p>
          <WeakTopics topics={weakTopics} onStart={(topic, mode) => {
            const keys = new Set(topic.cards.map((c) => `${c.deckId}:${c.index}`));
            session.start(mode, topic.topic, (item) => keys.has(`${item.deckId}:${item.index}`));
          }} />
        </section>
      )}

      <section aria-labelledby="decks" className="mt-14">
        <h2 id="decks" className="text-xl font-semibold">
          Your reviewers
        </h2>
        <div className="mt-4">
          {decks.length === 0 ? (
            <Empty className={groupClass}>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <GalleryVerticalEndIcon />
                </EmptyMedia>
                <EmptyTitle>No reviewers yet</EmptyTitle>
                <EmptyDescription>
                  Pick a subject or file and get flashcards on what you&apos;d be tested on, each linked to the line it came from.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <MakeDeckButton />
              </EmptyContent>
            </Empty>
          ) : (
            <DeckList decks={decks} />
          )}
        </div>
      </section>
      {session.dialog}
    </>
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

function WeakTopics({ topics, onStart }: { topics: WeakTopic[]; onStart: (topic: WeakTopic, mode: "cards" | "recall") => void }) {
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
              <Button variant="outline" onClick={() => onStart(t, "cards")}>
                <GalleryVerticalEndIcon />
                Review
              </Button>
              <Button variant="outline" onClick={() => onStart(t, "recall")}>
                <PenLineIcon />
                Test me
              </Button>
            </ItemActions>
          </Item>
        </div>
      ))}
    </ItemGroup>
  );
}

function HubSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-2xl" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <Skeleton className="mt-10 h-20 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
