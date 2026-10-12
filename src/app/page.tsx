import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, MapPin, NotebookPen, Quote, SearchX } from "lucide-react";
import {
  DocChip, FindPlayground, LiveDemo, NavShell, OpeningWordmark, Reveal, SpotlightCard, Steps, StreamedAnswer, Tour,
} from "@/components/landing";
import { Wordmark } from "@/components/logo";
import { ProductShot } from "@/components/product-shot";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const DESCRIPTION = "Upload PDFs, Word docs and notes, then ask in plain words. Every answer shows the line it came from.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://marginalia.aceguevarra.xyz"),
  title: { absolute: "Marginalia · Ask your documents" },
  description: DESCRIPTION,
  openGraph: {
    title: "Marginalia: ask your documents",
    description: DESCRIPTION,
    images: [{ url: "/product/og.png", width: 1200, height: 630, alt: "Marginalia on a laptop and a phone" }],
  },
  twitter: { card: "summary_large_image", images: ["/product/og.png"] },
};

const FEATURES = [
  { icon: Quote, title: "Every answer shows its source", body: "Tap a citation and the page opens with the passage highlighted, so you can check it yourself." },
  { icon: SearchX, title: "No made-up answers", body: "If your files don't say, Marginalia tells you so instead of guessing." },
  { icon: NotebookPen, title: "Write notes in it", body: "Draft in Markdown with a live preview. Save, and you can ask about it straight away." },
];

const USES = [
  { who: "Lecture notes", file: "ECON 101, lecture 4.pdf", q: "What causes inflation?", a: "Mostly **too much money chasing too few goods.**" },
  { who: "Your lease", file: "Lease agreement.pdf", q: "Can I have a cat?", a: "Yes, with the **landlord's written permission** and a $300 deposit." },
  { who: "Work docs", file: "IT onboarding.docx", q: "Which VPN do I set up?", a: "**GlobalProtect,** from the Self Service app on day one." },
];

const STEPS = [
  { title: "Sign up", body: "Just an email and a password." },
  { title: "Add your files", body: "PDFs, Word documents or your own notes." },
  { title: "Ask anything", body: "In plain words. Every answer shows where it came from." },
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
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#uses" className="transition-colors hover:text-foreground">Use cases</a>
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button asChild variant="ghost" size="lg">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/sign-up">Get started</Link>
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
            Answers with sources
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            <span className="block animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500">Ask your documents.</span>
            <span className="block animate-in fade-in slide-in-from-bottom-4 fill-mode-both delay-75 duration-500">See where every answer came from.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground animate-in fade-in fill-mode-both delay-150 duration-500">
            Upload PDFs, Word docs and your own notes, then ask in plain words. Marginalia answers in the margin, next to the line it came from.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 animate-in fade-in slide-in-from-bottom-2 fill-mode-both delay-200 duration-500 sm:flex-row">
            <Button asChild size="lg" className="group/cta h-11 px-5 text-base">
              <Link href="/sign-up">Get started<ArrowRight data-icon="inline-end" className="transition-transform group-hover/cta:translate-x-0.5" /></Link>
            </Button>
            <Button asChild variant="glass" size="lg" className="h-11 px-5 text-base">
              <a href="#watch">Watch the 30-second tour</a>
            </Button>
          </div>
          <div className="mx-auto mt-14 max-w-5xl animate-in fade-in slide-in-from-bottom-8 fill-mode-both delay-300 duration-700">
            <LiveDemo />
          </div>
        </section>

        {/* On devices */}
        <section className="mx-auto max-w-6xl px-5 pb-12">
          <Reveal className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">On your laptop and your phone.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">The same library and the same chats, wherever you happen to be reading.</p>
          </Reveal>
          <Reveal delay={80} className="mt-10">
            <ProductShot name="hero" alt="Marginalia answering a question with cited sources, on a laptop and a phone" />
          </Reveal>
        </section>

        {/* The problem */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <Reveal className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Search finds words. Marginalia finds answers.</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              The handbook says “roll over”. You searched “carry over”. Ctrl+F gives up. Marginalia understands what you meant.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Reveal><FindPlayground /></Reveal>
            <Reveal delay={80} className="h-full">
              <div className="h-full rounded-xl bg-card p-6 ring-1 ring-foreground/10">
                <p className="text-sm font-medium text-muted-foreground">Marginalia</p>
                <div className="mt-4">
                  <StreamedAnswer question="Does unused leave carry over?" answer="Yes. Up to **5 unused days** roll over to next year." source="Employee handbook, page 31" delay={700} />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Same handbook, asked the way you&apos;d ask a person.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
          <Reveal><h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Answers you can check.</h2></Reveal>
          <Reveal delay={80} className="mt-10">
            <ProductShot name="laptop-sources" alt="The sources beside an answer, each cited passage highlighted" className="mx-auto max-w-4xl" />
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 60} className="h-full">
                <SpotlightCard className="p-6">
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover/spot:scale-110 group-hover/spot:-rotate-6">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-muted-foreground">{body}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Use cases */}
        <section id="uses" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">For whatever you have to read.</h2>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Class notes before an exam, the fine print in a lease, the docs you get on your first week. Hover a card to ask again.</p>
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

        {/* The pet */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.4fr]">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">A little friend while you read.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Hatch a pixel pet and keep it in a pocket handheld. Feed it, play catch with it, put it to bed. It reads along with you and levels up every time you ask a question or add a file.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <ProductShot name="laptop-pet" alt="Mochi, a pixel cat in glasses, in its handheld inside Marginalia" />
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Start in under a minute.</h2>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Three steps from sign-up to your first cited answer.</p>
          </Reveal>
          <Steps steps={STEPS} />
        </section>

        {/* Video */}
        <section id="watch" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
          <Reveal><h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">See it in 30 seconds.</h2></Reveal>
          <Reveal delay={80} className="mt-10"><Tour /></Reveal>
        </section>

        {/* Call to action */}
        <section className="mx-auto max-w-6xl px-5 pt-10 pb-24">
          <Reveal>
            <div className="glass rounded-2xl border border-glass-border bg-glass px-6 py-16 text-center">
              <OpeningWordmark />
              <p className="mx-auto mt-8 max-w-md text-2xl font-semibold tracking-tight">Try it with your own documents.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="group/cta h-11 px-5 text-base">
                  <Link href="/sign-up">Get started<ArrowRight data-icon="inline-end" className="transition-transform group-hover/cta:translate-x-0.5" /></Link>
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
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">Ask your documents. Every answer shows the line it came from.</p>
          </div>
          <div className="text-sm">
            <p className="font-medium">Product</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><a href="#features" className="transition-colors hover:text-foreground">Features</a></li>
              <li><a href="#how" className="transition-colors hover:text-foreground">How it works</a></li>
              <li><Link href="/sign-up" className="transition-colors hover:text-foreground">Get started</Link></li>
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
