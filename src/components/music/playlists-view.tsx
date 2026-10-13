"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { useMusic } from "@/lib/music";
import { MAX_SONG_BYTES, SONG_ACCEPT, SONG_FORMATS_LABEL, formatBytes } from "@/lib/song-store";
import { cn } from "@/lib/utils";
import { MusicLibrary } from "./music-library";

/** Playlists: drop your study sounds in, organise them, and choose what plays. */
export function PlaylistsView() {
  const music = useMusic();
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const upload = async (files: FileList | File[]) => {
    const { added, rejected } = await music.add(files);
    if (added) toast.success(`Added ${added} ${added === 1 ? "song" : "songs"}`);
    for (const reason of rejected.slice(0, 3)) toast.error(reason);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-5 pt-14 pb-24 sm:px-8 lg:px-12">
        <h1 className="text-3xl font-bold tracking-tight">Playlists</h1>
        <p className="mt-2 text-muted-foreground">Your own sounds to study to. They keep playing as you move around the app.</p>

        {/* Drop songs anywhere in here, or pick them */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
          }}
          className={cn(
            "mt-8 grid w-full justify-items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-150",
            over ? "border-primary bg-primary/10" : "border-glass-border bg-glass hover:border-primary/50"
          )}
        >
          <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <UploadIcon className="size-5" />
          </span>
          <span className="text-lg font-semibold">{over ? "Drop to add" : "Drop songs here, or click to upload"}</span>
          <span className="text-sm text-muted-foreground">
            {SONG_FORMATS_LABEL}, up to {formatBytes(MAX_SONG_BYTES)} each. Lo-fi, rain, ambient, anything. Saved on this device, never uploaded.
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={SONG_ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const files = e.target.files;
            if (files?.length) void upload(files);
            e.target.value = "";
          }}
        />

        <div className="glass mt-8 rounded-2xl border border-glass-border bg-glass p-6">
          <MusicLibrary showUpload={false} />
        </div>
      </div>
    </div>
  );
}
