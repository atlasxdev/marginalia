"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ListMusicIcon, MusicIcon, PauseIcon, PlayIcon, PlusIcon, Repeat1Icon, RepeatIcon, SkipBackIcon, SkipForwardIcon, Volume2Icon } from "lucide-react";
import { useMusic } from "@/lib/music";
import { toast } from "sonner";
import { setSoundsOn, soundsOn } from "@/lib/pet-sounds";
import { MAX_SONG_BYTES, SONG_ACCEPT, SONG_FORMATS_LABEL, formatBytes } from "@/lib/song-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Play, skip, repeat and volume for the app's music, with what plays (all songs or a playlist). */
export function MusicControls({ compact = false }: { compact?: boolean }) {
  const music = useMusic();
  return (
    <div className={cn("grid gap-2", !compact && "rounded-xl bg-foreground/5 p-3")}>
      <p className="truncate text-sm font-medium">{music.song ? music.song.name : music.queue.length ? "Nothing playing" : "No songs yet"}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" disabled={music.queue.length < 2} onClick={() => music.step(-1)} aria-label="Previous song">
            <SkipBackIcon />
          </Button>
          <Button size="icon" disabled={!music.queue.length} onClick={music.toggle} aria-label={music.playing ? "Pause" : "Play"} className="rounded-full">
            {music.playing ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button variant="ghost" size="icon" disabled={music.queue.length < 2} onClick={() => music.step(1)} aria-label="Next song">
            <SkipForwardIcon />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => music.setRepeatOne(!music.repeatOne)}
          aria-label={music.repeatOne ? "Repeating this song" : "Playing through the list"}
          className={cn(music.repeatOne ? "text-primary" : "text-muted-foreground")}
        >
          {music.repeatOne ? <Repeat1Icon /> : <RepeatIcon />}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-muted-foreground">
        <Volume2Icon className="size-4 shrink-0" />
        <span className="sr-only">Volume</span>
        <input type="range" min={0} max={100} value={music.volume} onChange={(e) => music.setVolume(Number(e.target.value))} className="w-full accent-primary" />
      </label>
    </div>
  );
}

/** Choose what plays: all your songs, or one playlist. */
export function SourcePicker() {
  const music = useMusic();
  if (!music.playlists.length) return null;
  return (
    <Select
      value={music.source}
      onValueChange={(v) => {
        music.setSource(v);
      }}
    >
      <SelectTrigger className="h-9 w-full rounded-lg" aria-label="What plays">
        <ListMusicIcon className="size-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All songs ({music.songs.length})</SelectItem>
        {music.playlists.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name} ({p.songIds.length})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The music button: now playing, controls, what plays, your songs, and a way to add more. */
export function MusicButton({ className, align = "end" }: { className?: string; align?: "start" | "end" }) {
  const music = useMusic();
  const fileRef = useRef<HTMLInputElement>(null);
  const [effects, setEffects] = useState(soundsOn);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={music.playing && music.song ? `Music: playing ${music.song.name}` : "Music"}
          className={cn("text-muted-foreground", music.playing && "text-primary", className)}
        >
          <MusicIcon className={cn(music.playing && "animate-pulse motion-reduce:animate-none")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Music</p>
          <Button variant="link" size="sm" asChild className="h-auto p-0">
            <Link href="/playlists">Playlists</Link>
          </Button>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">Keeps playing as you move around the app.</p>

        <div className="mt-4 grid gap-2">
          <MusicControls />
          <SourcePicker />
        </div>

        {music.queue.length > 0 && (
          <ul className="mt-2 grid max-h-44 gap-0.5 overflow-y-auto" aria-label="Songs">
            {music.queue.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => music.play(s.id)}
                  className={cn("w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-foreground/5", music.song?.id === s.id && "text-primary")}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}

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
            if (files?.length)
              void music.add(files).then(({ added, rejected }) => {
                if (added) toast.success(`Added ${added} ${added === 1 ? "song" : "songs"}`);
                for (const reason of rejected.slice(0, 3)) toast.error(reason);
              });
            e.target.value = "";
          }}
        />
        <Button variant="outline" className="mt-3 w-full" onClick={() => fileRef.current?.click()}>
          <PlusIcon />
          Add songs
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          {SONG_FORMATS_LABEL}, up to {formatBytes(MAX_SONG_BYTES)} each. Saved on this device, not uploaded.
        </p>

        <label className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
          <span>
            <span className="block font-medium">Sound effects</span>
            <span className="text-xs text-muted-foreground">Your buddy&apos;s chirps, card flips and the finish jingle</span>
          </span>
          <Checkbox
            checked={effects}
            onCheckedChange={(v) => {
              setEffects(!!v);
              setSoundsOn(!!v);
            }}
          />
        </label>
      </PopoverContent>
    </Popover>
  );
}

/** A slim now-playing row for the sidebar, shown once something has played. */
export function NowPlaying() {
  const music = useMusic();
  if (!music.song) return null;
  return (
    <div className="flex items-center gap-1 rounded-xl px-2 py-1">
      <Button variant="ghost" size="icon" onClick={music.toggle} aria-label={music.playing ? "Pause music" : "Play music"} className="size-8 shrink-0">
        {music.playing ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{music.song.name}</span>
      <MusicButton align="start" className="size-8 shrink-0" />
    </div>
  );
}
