"use client";

import "pdfjs-dist/web/pdf_viewer.css";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { CitedSource } from "@/lib/format-response";
import { getBrowserClient } from "@/lib/supabase/client";

type LoadedFile = { filename: string; mimeType: string; bytes: ArrayBuffer };

// Letters and digits only, so markdown, line breaks and PDF spacing don't stop a match
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Whether a piece of the document belongs to the cited passage
function isPartOf(text: string, passage: string, minLength: number) {
  const t = normalize(text);
  if (t.length < minLength) return false;
  return passage.includes(t) || (passage.length >= 40 && t.includes(passage.slice(0, 40)));
}

// Opens a cited passage inside its document: the PDF at its page, or the text scrolled to it
export function SourceViewer({ source, onClose }: { source: CitedSource | null; onClose: () => void }) {
  return (
    <Dialog open={!!source} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass flex h-[90dvh] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border border-glass-border bg-glass-strong p-0 sm:max-w-5xl">
        {source && <Viewer key={source.chunkId} source={source} />}
      </DialogContent>
    </Dialog>
  );
}

function Viewer({ source }: { source: CitedSource }) {
  const file = useQuery({
    queryKey: ["document-file", source.documentId],
    queryFn: async (): Promise<LoadedFile> => {
      const supabase = getBrowserClient();
      const { data: doc } = await supabase
        .from("documents")
        .select("filename, mime_type, storage_path")
        .eq("id", source.documentId)
        .maybeSingle();
      if (!doc) throw new Error("This document isn't in your library any more.");
      const { data: blob } = await supabase.storage.from("documents").download(doc.storage_path);
      if (!blob) throw new Error("Couldn't open this document. Try again.");
      return { filename: doc.filename, mimeType: doc.mime_type, bytes: await blob.arrayBuffer() };
    },
    staleTime: Infinity,
  });
  // The excerpt may end with "…" where it was shortened
  const passage = normalize(source.excerpt.replace(/…$/, ""));
  const page = Number(source.headingPath.match(/^Page (\d+)/)?.[1]) || 1;

  return (
    <>
      <DialogHeader className="border-b border-glass-divider px-6 py-5 pr-14">
        <DialogTitle className="truncate">{file.data?.filename ?? source.documentTitle}</DialogTitle>
        <DialogDescription className="truncate">
          {source.headingPath || "Cited passage"}, highlighted
        </DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-hidden">
        {file.isPending ? (
          <p className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <Spinner />
            Opening document…
          </p>
        ) : file.isError ? (
          <p role="alert" className="flex h-full items-center justify-center px-6 text-center text-destructive">
            {file.error.message}
          </p>
        ) : file.data.mimeType === "application/pdf" ? (
          <PdfView bytes={file.data.bytes} page={page} passage={passage} />
        ) : (
          <TextView file={file.data} passage={passage} />
        )}
      </div>
    </>
  );
}

/* Every page gets a placeholder of the right size; the cited page renders first
   with a text layer for the highlight, and the rest render as they scroll into view. */
function PdfView({ bytes, page, passage }: { bytes: ArrayBuffer; page: number; passage: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let cancelled = false;
    let pdf: PDFDocumentProxy | undefined;
    let observer: IntersectionObserver | undefined;

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      // pdf.js takes ownership of the buffer it's given, so it gets a copy
      pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
      const width = scroller.clientWidth - 32;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pages: { el: HTMLDivElement; page: PDFPageProxy; scale: number; rendered: boolean }[] = [];

      for (let n = 1; n <= pdf.numPages && !cancelled; n++) {
        const p = await pdf.getPage(n);
        const scale = width / p.getViewport({ scale: 1 }).width;
        const viewport = p.getViewport({ scale });
        const el = document.createElement("div");
        el.className = "pdf-page";
        el.dataset.page = String(n);
        el.style.width = `${viewport.width}px`;
        el.style.height = `${viewport.height}px`;
        scroller.firstElementChild?.appendChild(el);
        pages.push({ el, page: p, scale, rendered: false });
      }
      if (cancelled) return;

      const render = async (entry: (typeof pages)[number], withText: boolean) => {
        if (entry.rendered) return;
        entry.rendered = true;
        const viewport = entry.page.getViewport({ scale: entry.scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        entry.el.appendChild(canvas);
        await entry.page.render({
          canvas,
          canvasContext: canvas.getContext("2d")!,
          viewport,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        }).promise;
        if (!withText) return;
        const text = document.createElement("div");
        text.className = "textLayer";
        entry.el.style.setProperty("--scale-factor", String(entry.scale));
        entry.el.style.setProperty("--total-scale-factor", String(entry.scale));
        entry.el.appendChild(text);
        await new pdfjs.TextLayer({ textContentSource: await entry.page.getTextContent(), container: text, viewport }).render();
        for (const span of text.querySelectorAll("span")) {
          if (isPartOf(span.textContent ?? "", passage, 4)) span.classList.add("source-match");
        }
      };

      const target = pages[Math.min(page, pages.length) - 1];
      await render(target, true);
      if (cancelled) return;
      const match = target.el.querySelector(".source-match") as HTMLElement | null;
      scroller.scrollTop = target.el.offsetTop + (match ? match.offsetTop - scroller.clientHeight / 3 : -16);

      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const entry = pages.find((p) => p.el === e.target);
            if (e.isIntersecting && entry) render(entry, false);
          }
        },
        { root: scroller, rootMargin: "600px 0px" }
      );
      for (const p of pages) observer.observe(p.el);
    })().catch((error) => {
      if (cancelled) return;
      console.error("Couldn't render PDF:", error);
      setFailed(true);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      scroller.firstElementChild?.replaceChildren();
      pdf?.destroy();
    };
  }, [bytes, page, passage]);

  if (failed) {
    return (
      <p role="alert" className="flex h-full items-center justify-center text-destructive">
        Couldn&apos;t show this PDF.
      </p>
    );
  }
  return (
    <div ref={scrollRef} className="h-full overflow-y-auto bg-muted/40 px-4 py-6">
      <div className="mx-auto flex w-fit flex-col gap-4" />
    </div>
  );
}

// Markdown shows as written; Word files are converted in the browser the same way ingestion does
function TextView({ file, passage }: { file: LoadedFile; passage: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const markdown = useQuery({
    queryKey: ["document-markdown", file.filename, file.bytes.byteLength],
    queryFn: async () => {
      if (file.mimeType === "text/markdown") return new TextDecoder().decode(file.bytes);
      const mammoth = (await import("mammoth")) as unknown as {
        convertToMarkdown: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
      };
      const { value } = await mammoth.convertToMarkdown({ arrayBuffer: file.bytes });
      return value.replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1");
    },
    staleTime: Infinity,
  });

  // Highlight the blocks that make up the passage and bring the first into view
  useEffect(() => {
    const root = ref.current;
    if (!root || !markdown.data) return;
    let first: Element | null = null;
    for (const block of root.querySelectorAll("p, li:not(:has(p)), td, th, h1, h2, h3, h4, h5, h6, pre")) {
      if (isPartOf(block.textContent ?? "", passage, 12)) {
        block.classList.add("source-match");
        first ??= block;
      }
    }
    first?.scrollIntoView({ block: "center" });
  }, [markdown.data, passage]);

  if (!markdown.data) {
    return (
      <p className="flex h-full items-center justify-center gap-2 text-muted-foreground">
        <Spinner />
        Opening document…
      </p>
    );
  }
  return (
    <div className="h-full overflow-y-auto">
      <div ref={ref} className="answer doc mx-auto max-w-3xl px-6 py-8 sm:px-10">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {markdown.data}
        </ReactMarkdown>
      </div>
    </div>
  );
}
