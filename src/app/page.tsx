import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Brain, Check, GraduationCap, Lightbulb, Mail, MapPin, Timer } from "lucide-react";
import {
  DocChip, ExamDemo, ExplainDemo, HandheldDemo, MusicDemo, NavShell, NotesDemo, OpeningWordmark, RecallDemo, Reveal, SessionDemo, SpotlightCard, Steps, StreamedAnswer, TodayDemo,
} from "@/components/landing";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/site";

const DESCRIPTION =
  "Add your lecture notes and they turn into flashcards on their own. Study in focus sessions with a pixel buddy that checks your answers against your notes, explains what you miss, runs practice exams and plays your own study music.";

export const metadata: Metadata = {
  title: { absolute: "Marginalia · Your study buddy for your own notes" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Marginalia",
    locale: "en_US",
    url: "/",
    title: "Marginalia: your study buddy for your own notes",
    description: DESCRIPTION,
    images: [{ url: "/product/og.png", width: 1200, height: 630, alt: "Marginalia on a laptop and a phone" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marginalia: your study buddy for your own notes",
    description: DESCRIPTION,
    images: ["/product/og.png"],
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Marginalia",
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  image: `${SITE_URL}/product/og.png`,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Ace Guevarra", url: "https://www.aceguevarra.xyz" },
};

/* The four ways Marginalia helps. Each is a set of real features, not a separate mode. */
const MODES = [
  {
    icon: Timer,
    title: "Focus",
    tagline: "Build a study habit that sticks.",
    points: ["Focus sessions with Pomodoro or long blocks", "A buddy that studies beside you and grows", "Your own study music, and a daily goal"],
  },
  {
    icon: Brain,
    title: "Remember",
    tagline: "Keep what you learn for longer.",
    points: ["Flashcards made from your notes on their own", "Typed answers checked against your notes", "Cards come back right before you'd forget them"],
  },
  {
    icon: Lightbulb,
    title: "Understand",
    tagline: "Get the ideas, not just the words.",
    points: ["Miss a card and your buddy explains it", "Explain it back and it checks your explanation", "Practice questions on the exact point you missed"],
  },
  {
    icon: GraduationCap,
    title: "Exam",
    tagline: "Walk in ready.",
    points: ["Timed practice exams across a whole subject", "A score for every topic, weakest first", "A session on the questions you missed"],
  },
];

const USES = [
  { who: "Biology", file: "Lecture 3, respiration.pdf", q: "What does the electron transport chain make?", a: "Most of the cell's **ATP,** about **34 per glucose.**" },
  { who: "History", file: "Chapter 9 reading.docx", q: "Why was France in crisis by 1788?", a: "It was **deep in debt** from war, and **bread prices had doubled.**" },
  { who: "Economics", file: "ECON 101, lecture 4.pdf", q: "How do central banks slow inflation?", a: "They **raise interest rates.**" },
];

const STEPS = [
  { title: "Add a subject", body: "One for each class, like Biology or World History." },
  { title: "Add your notes", body: "Lecture notes, readings and handouts. The flashcards make themselves." },
  { title: "Press Study", body: "A focus session with your buddy: cards, quick quizzes and typed answers, with breaks." },
];

const ME = {
  name: "Ace Guevarra",
  site: "https://www.aceguevarra.xyz",
  email: "aceguevarra.dev@gmail.com",
  github: "https://github.com/atlasxdev",
  linkedin: "https://www.linkedin.com/in/devace-guevarra/",
  location: "Calamba City, Laguna",
};

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" /></svg>
);
const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" /></svg>
);

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      {/* Drifting colour behind the glass */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 size-[38rem] rounded-full bg-primary/20 blur-3xl animate-[drift_22s_ease-in-out_infinite_alternate] motion-reduce:animate-none" />
        <div className="absolute top-1/3 -right-48 size-[34rem] rounded-full bg-[#4d9cff]/20 blur-3xl animate-[drift_28s_ease-in-out_infinite_alternate-reverse] motion-reduce:animate-none" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-5">
        <NavShell>
          <Link href="/" aria-label="Marginalia home">
            <Wordmark className="text-2xl" />
          </Link>
          <div className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">How it helps</a>
            <a href="#buddy" className="transition-colors hover:text-foreground">Your buddy</a>
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button asChild variant="ghost" size="lg">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/sign-up">Start studying</Link>
            </Button>
          </div>
        </NavShell>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-20 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary animate-in fade-in zoom-in-95 duration-300">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Your study buddy
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            <span className="block animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500">Study from your own notes.</span>
            <span className="block animate-in fade-in slide-in-from-bottom-4 fill-mode-both delay-75 duration-500">With a buddy that keeps you going.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground animate-in fade-in fill-mode-both delay-150 duration-500">
            Add your lecture notes and they turn into flashcards on their own. Then study in focus sessions with a buddy that checks your answers, explains what you miss, and gets you exam-ready.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 animate-in fade-in slide-in-from-bottom-2 fill-mode-both delay-200 duration-500 sm:flex-row">
            <Button asChild size="lg" className="group/cta h-11 px-5 text-base">
              <Link href="/sign-up">Start studying<ArrowRight data-icon="inline-end" className="transition-transform group-hover/cta:translate-x-0.5" /></Link>
            </Button>
            <Button asChild variant="glass" size="lg" className="h-11 px-5 text-base">
              <a href="#how">See how it works</a>
            </Button>
          </div>
          <div className="mx-auto mt-14 max-w-4xl animate-in fade-in slide-in-from-bottom-8 fill-mode-both delay-300 duration-700">
            <SessionDemo />
          </div>
        </section>

        {/* Notes become flashcards */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Add your notes. The flashcards make themselves.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Make a subject for each class and drop in its notes. Your buddy reads them and writes flashcards on what you&apos;d be tested on, each linked to the line it came from. No more writing reviewers by hand.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <NotesDemo />
            </Reveal>
          </div>
        </section>

        {/* Test me */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <Reveal className="lg:order-last">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Say it in your own words. Your buddy checks it.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Rereading feels like studying. Recalling is what sticks. Type what you remember, and Marginalia marks it right, almost or wrong against your notes, with the line that has the full answer.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <RecallDemo />
            </Reveal>
          </div>
        </section>

        {/* Stuck? It explains */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Get one wrong? It explains, then you explain it back.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Miss a card because the idea&apos;s muddled, and your buddy explains it from your notes. Then you put it in your own words and it checks you. Got the idea but slipped on a detail? You get two fresh practice questions on that exact point.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <ExplainDemo />
            </Reveal>
          </div>
        </section>

        {/* Practice exams */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <Reveal className="lg:order-last">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Practice exams, before the real one.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Mixed questions from across a subject, timed, with no hints until you hand it in. You get a score for every topic, weakest first, and one tap to study just the ones you missed.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <ExamDemo />
            </Reveal>
          </div>
        </section>

        {/* Today */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">It knows what to study today.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Open Marginalia and your buddy has picked the subject that needs you most: reviews due first, then weak topics. Set a daily goal, keep your streak, and watch your focus time add up.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <TodayDemo />
            </Reveal>
          </div>
        </section>

        {/* Music */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <Reveal className="lg:order-last">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your own study music.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Upload your lo-fi, rain or piano tracks and make playlists for every mood. Music keeps playing as you move between subjects, sessions and notes, and can pause itself on breaks. Your songs stay on your device.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <MusicDemo />
            </Reveal>
          </div>
        </section>

        {/* Four ways it helps */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Four ways it helps you study.</h2>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              All in one session, from your own notes. Your buddy picks what you need next.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODES.map(({ icon: Icon, title, tagline, points }, i) => (
              <Reveal key={title} delay={i * 60} className="h-full">
                <SpotlightCard className="flex h-full flex-col p-6">
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover/spot:scale-110 group-hover/spot:-rotate-6">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                  <p className="mt-1 text-muted-foreground">{tagline}</p>
                  <ul className="mt-5 grid gap-2.5 text-sm">
                    {points.map((pt) => (
                      <li key={pt} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Your buddy */}
        <section id="buddy" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">A study buddy that studies with you.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Hatch a pixel buddy and it sits on your cards in every session: it hops when you get one right and offers to explain when you don&apos;t. It&apos;s proud when you show up, worried when cards pile up, and naps if you skip days.
              </p>
              <p className="mt-4 text-muted-foreground">
                As you study it levels up, and its room fills with books, then a lamp, a trophy and a diploma. Try its handheld: the arrows and A to choose, B to pet it.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <HandheldDemo />
            </Reveal>
          </div>
        </section>

        {/* Use cases */}
        <section id="uses" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Ask any class.</h2>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Each subject answers only from its own notes, like a classmate who actually took them. Hover a card to ask again.</p>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {USES.map((u, i) => (
              <Reveal key={u.file} delay={i * 60} className="h-full">
                <SpotlightCard className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{u.who}</span>
                    <DocChip name={u.file} />
                  </div>
                  <div className="mt-4">
                    <StreamedAnswer question={u.q} answer={u.a} delay={200 + i * 250} />
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Start in under a minute.</h2>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Three steps from your notes to your first session.</p>
          </Reveal>
          <Steps steps={STEPS} />
        </section>

        {/* Call to action */}
        <section className="mx-auto max-w-6xl px-5 pt-10 pb-24">
          <Reveal>
            <div className="glass rounded-2xl border border-glass-border bg-glass px-6 py-16 text-center">
              <OpeningWordmark />
              <p className="mx-auto mt-8 max-w-md text-2xl font-semibold tracking-tight">Bring your notes. Your buddy&apos;s ready.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="group/cta h-11 px-5 text-base">
                  <Link href="/sign-up">Start studying<ArrowRight data-icon="inline-end" className="transition-transform group-hover/cta:translate-x-0.5" /></Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="h-11 px-5 text-base">
                  <Link href="/sign-in">I have an account</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark className="text-2xl" />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">Your study buddy for your own notes. Every answer shows the line it came from.</p>
          </div>
          <div className="text-sm">
            <p className="font-medium">Product</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><a href="#features" className="transition-colors hover:text-foreground">How it helps</a></li>
              <li><a href="#buddy" className="transition-colors hover:text-foreground">Your buddy</a></li>
              <li><a href="#how" className="transition-colors hover:text-foreground">How it works</a></li>
              <li><Link href="/sign-up" className="transition-colors hover:text-foreground">Start studying</Link></li>
              <li><Link href="/sign-in" className="transition-colors hover:text-foreground">Sign in</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-medium">Made by {ME.name}</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><a href={ME.site} className="transition-colors hover:text-foreground">aceguevarra.xyz</a></li>
              <li><a href={`mailto:${ME.email}`} className="inline-flex items-center gap-2 transition-colors hover:text-foreground"><Mail className="size-4" />{ME.email}</a></li>
              <li className="inline-flex items-center gap-2"><MapPin className="size-4" />{ME.location}</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <Button asChild variant="glass" size="icon-lg" aria-label="GitHub"><a href={ME.github}><GitHubIcon /></a></Button>
              <Button asChild variant="glass" size="icon-lg" aria-label="LinkedIn"><a href={ME.linkedin}><LinkedInIcon /></a></Button>
              <Button asChild variant="glass" size="icon-lg" aria-label="Email"><a href={`mailto:${ME.email}`}><Mail /></a></Button>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-6xl border-t border-border px-5 py-5 text-xs text-muted-foreground">
          © 2026 {ME.name}
        </div>
      </footer>
    </div>
  );
}
