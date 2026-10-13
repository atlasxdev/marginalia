"use client";

import { useRef, useState } from "react";
import { ListMusicIcon, MusicIcon, PencilIcon, PlayIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { useMusic } from "@/lib/music";
import { MAX_LIBRARY_BYTES, MAX_SONGS, MAX_SONG_BYTES, SONG_ACCEPT, SONG_FORMATS_LABEL, formatBytes } from "@/lib/song-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { MusicControls, SourcePicker } from "./music-button";

/** Settings: your music library. Upload songs, name them, make playlists, choose what plays. */
export function MusicLibrary() {
  const music = useMusic();
  const fileRef = useRef<HTMLInputElement>(null);
  const [newPlaylist, setNewPlaylist] = useState("");

  const upload = async (files: FileList) => {
    const { added, rejected } = await music.add(files);
    if (added) toast.success(`Added ${added} ${added === 1 ? "song" : "songs"}`);
    for (const reason of rejected.slice(0, 3)) toast.error(reason);
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <MusicControls />
        <div className="grid content-start gap-3">
          <SourcePicker />
          <label className="flex items-start justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium">Stop when a focus block ends</span>
              <span className="text-xs text-muted-foreground">Music pauses for your break, and when a session ends.</span>
            </span>
            <Checkbox checked={music.stopOnBreak} onCheckedChange={(v) => music.setStopOnBreak(!!v)} />
          </label>
        </div>
      </div>

      {/* Songs */}
      <div className="grid gap-3 border-t border-glass-divider pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Your songs</p>
            <p className="text-sm text-muted-foreground">
              {SONG_FORMATS_LABEL}, up to {formatBytes(MAX_SONG_BYTES)} each. Saved on this device and never uploaded.
            </p>
          </div>
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
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <UploadIcon />
            Upload songs
          </Button>
        </div>
        {/* How much of the library is used */}
        <div className="grid gap-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
            <div
              className={cn("h-full rounded-full", music.used / MAX_LIBRARY_BYTES > 0.9 ? "bg-amber-500" : "bg-primary")}
              style={{ width: `${Math.min(100, (music.used / MAX_LIBRARY_BYTES) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatBytes(music.used)} of {formatBytes(MAX_LIBRARY_BYTES)} used, {music.songs.length} of {MAX_SONGS} songs
          </p>
        </div>
        {music.songs.length === 0 ? (
          <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-glass-border px-4 py-8 text-center">
            <MusicIcon className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Upload lo-fi, rain, nature or instrumental sounds to study to.</p>
          </div>
        ) : (
          <ul className="grid gap-1">
            {music.songs.map((s) => (
              <SongRow key={s.id} id={s.id} name={s.name} />
            ))}
          </ul>
        )}
      </div>

      {/* Playlists */}
      <div className="grid gap-3 border-t border-glass-divider pt-6">
        <div>
          <p className="font-medium">Playlists</p>
          <p className="text-sm text-muted-foreground">Group songs for different moods, then pick one to play from the music menu.</p>
        </div>
        {music.playlists.map((p) => (
          <PlaylistRow key={p.id} id={p.id} />
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newPlaylist.trim()) return;
            music.createPlaylist(newPlaylist);
            setNewPlaylist("");
          }}
        >
          <Input value={newPlaylist} onChange={(e) => setNewPlaylist(e.target.value)} placeholder="New playlist, like Rainy focus" aria-label="New playlist name" className="h-10 rounded-xl" maxLength={60} />
          <Button type="submit" variant="outline" disabled={!newPlaylist.trim()} className="h-10">
            <PlusIcon />
            Create
          </Button>
        </form>
      </div>
    </div>
  );
}

function SongRow({ id, name }: { id: string; name: string }) {
  const music = useMusic();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const active = music.song?.id === id;
  const save = () => {
    music.rename(id, draft);
    setEditing(false);
  };
  return (
    <li className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-foreground/5", active && "bg-primary/5")}>
      <Button variant="ghost" size="icon" onClick={() => (active ? music.toggle() : music.play(id))} aria-label={`Play ${name}`} className={cn("size-8", active && "text-primary")}>
        <PlayIcon />
      </Button>
      {editing ? (
        <form
          className="flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save} autoFocus aria-label="Song name" className="h-8 rounded-lg" maxLength={80} />
        </form>
      ) : (
        <span className={cn("min-w-0 flex-1 truncate text-sm", active && "font-medium text-primary")}>{name}</span>
      )}
      <Button variant="ghost" size="icon" onClick={() => (setDraft(name), setEditing(true))} aria-label={`Rename ${name}`} className="size-8 text-muted-foreground">
        <PencilIcon />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => music.remove(id)} aria-label={`Remove ${name}`} className="size-8 text-muted-foreground hover:text-destructive">
        <Trash2Icon />
      </Button>
    </li>
  );
}

function PlaylistRow({ id }: { id: string }) {
  const music = useMusic();
  const playlist = music.playlists.find((p) => p.id === id)!;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(playlist.name);
  const save = () => {
    music.renamePlaylist(id, draft);
    setEditing(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-glass-border px-3 py-2">
      <ListMusicIcon className="size-4 shrink-0 text-muted-foreground" />
      {editing ? (
        <form
          className="min-w-40 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save} autoFocus aria-label="Playlist name" className="h-8 rounded-lg" maxLength={60} />
        </form>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {playlist.name} <span className="font-normal text-muted-foreground">({playlist.songIds.length})</span>
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={!music.songs.length}>
            Songs
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
          <DropdownMenuLabel>In {playlist.name}</DropdownMenuLabel>
          {music.songs.map((s) => (
            <DropdownMenuCheckboxItem
              key={s.id}
              checked={playlist.songIds.includes(s.id)}
              onCheckedChange={() => music.toggleInPlaylist(id, s.id)}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="truncate">{s.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="sm"
        disabled={!playlist.songIds.length}
        onClick={() => {
          music.setSource(id);
          music.play(playlist.songIds[0]);
        }}
      >
        <PlayIcon />
        Play
      </Button>
      <Button variant="ghost" size="icon" onClick={() => (setDraft(playlist.name), setEditing(true))} aria-label={`Rename ${playlist.name}`} className="size-8 text-muted-foreground">
        <PencilIcon />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => music.removePlaylist(id)} aria-label={`Delete ${playlist.name}`} className="size-8 text-muted-foreground hover:text-destructive">
        <Trash2Icon />
      </Button>
    </div>
  );
}
