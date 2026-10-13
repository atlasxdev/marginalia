"use client";

import { useRef, useState } from "react";
import {
  CheckIcon,
  ListMusicIcon,
  ListPlusIcon,
  MoreHorizontalIcon,
  MusicIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Repeat1Icon,
  RepeatIcon,
  SkipBackIcon,
  ShuffleIcon,
  SkipForwardIcon,
  Trash2Icon,
  UploadIcon,
  Volume2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { useMusic } from "@/lib/music";
import { MAX_LIBRARY_BYTES, MAX_SONGS, MAX_SONG_BYTES, SONG_ACCEPT, SONG_FORMATS_LABEL, formatBytes, type Song } from "@/lib/song-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const groupClass = "glass rounded-2xl border border-glass-border bg-glass";

/* Playlists, laid out like a music app: what's playing across the top, your
   lists on the left, and the songs in the chosen list on the right. Drop
   songs anywhere on the page to add them. */
export function PlaylistsView() {
  const music = useMusic();
  const fileRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState("all");
  const [dragging, setDragging] = useState(false);

  const upload = async (files: FileList | File[]) => {
    const { added, rejected } = await music.add(files);
    if (added) toast.success(`Added ${added} ${added === 1 ? "song" : "songs"}`);
    for (const reason of rejected.slice(0, 3)) toast.error(reason);
  };

  const playlist = music.playlists.find((p) => p.id === view) ?? null;
  const list: Song[] = playlist ? playlist.songIds.map((id) => music.songs.find((s) => s.id === id)).filter((s): s is Song => !!s) : music.songs;

  return (
    <div
      className="relative h-full overflow-y-auto"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
      }}
    >
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

      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <p className="flex items-center gap-2 text-lg font-semibold text-primary">
            <UploadIcon className="size-5" />
            Drop to add your songs
          </p>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-5 pt-14 pb-24 sm:px-8 lg:px-12">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Playlists</h1>
            <p className="mt-1.5 text-muted-foreground">Your own sounds to study to. They keep playing as you move around the app.</p>
          </div>
          <Button size="lg" onClick={() => fileRef.current?.click()}>
            <UploadIcon />
            Upload songs
          </Button>
        </div>

        <NowPlaying />

        {music.songs.length === 0 ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-8 grid w-full justify-items-center gap-3 rounded-2xl border-2 border-dashed border-glass-border bg-glass px-6 py-16 text-center transition-colors duration-150 hover:border-primary/50"
          >
            <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
              <MusicIcon className="size-6" />
            </span>
            <span className="text-lg font-semibold">Add your first songs</span>
            <span className="max-w-md text-sm text-muted-foreground">
              Drop lo-fi, rain, nature or instrumental sounds here, or click to pick them. {SONG_FORMATS_LABEL}, up to {formatBytes(MAX_SONG_BYTES)} each.
            </span>
          </button>
        ) : (
          <>
            <Lists view={view} setView={setView} />
            <div className="mt-8">
              <Tracks title={playlist ? playlist.name : "All songs"} playlistId={playlist?.id ?? null} songs={list} />
            </div>
          </>
        )}

        <Storage />
      </div>
    </div>
  );
}

/* ---------- now playing ---------- */

function NowPlaying() {
  const music = useMusic();
  const source = music.playlists.find((p) => p.id === music.source);
  return (
    <section aria-label="Now playing" className={`${groupClass} mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 p-5`}>
      <div className="flex min-w-0 flex-1 basis-full items-center gap-4 sm:basis-auto">
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl", music.playing ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-muted-foreground")}>
          <MusicIcon className={cn("size-5", music.playing && "animate-pulse motion-reduce:animate-none")} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{music.song ? music.song.name : "Nothing playing"}</p>
          <p className="truncate text-sm text-muted-foreground">{source ? `From ${source.name}` : "From all songs"}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" disabled={music.queue.length < 2} onClick={() => music.step(-1)} aria-label="Previous song">
          <SkipBackIcon />
        </Button>
        <Button size="icon" disabled={!music.queue.length} onClick={music.toggle} aria-label={music.playing ? "Pause" : "Play"} className="size-11 rounded-full">
          {music.playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button variant="ghost" size="icon" disabled={music.queue.length < 2} onClick={() => music.step(1)} aria-label="Next song">
          <SkipForwardIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => music.setShuffle(!music.shuffle)}
          aria-label={music.shuffle ? "Shuffle on" : "Shuffle off"}
          aria-pressed={music.shuffle}
          className={music.shuffle ? "text-primary" : "text-muted-foreground"}
        >
          <ShuffleIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => music.setRepeatOne(!music.repeatOne)}
          aria-label={music.repeatOne ? "Repeating this song" : "Playing through the list"}
          className={music.repeatOne ? "text-primary" : "text-muted-foreground"}
        >
          {music.repeatOne ? <Repeat1Icon /> : <RepeatIcon />}
        </Button>
      </div>
      <label className="flex w-full items-center gap-2 text-muted-foreground sm:w-44">
        <Volume2Icon className="size-4 shrink-0" />
        <span className="sr-only">Volume</span>
        <input type="range" min={0} max={100} value={music.volume} onChange={(e) => music.setVolume(Number(e.target.value))} className="w-full accent-primary" />
      </label>
    </section>
  );
}

/* ---------- your lists, as a grid of cards ---------- */

// Each playlist gets its own colour, picked from its id so it stays the same
const TILE_COLORS = ["bg-[#0152cb]", "bg-[#7c3aed]", "bg-[#0891b2]", "bg-[#db2777]", "bg-[#16a34a]", "bg-[#ea580c]"];
const tileColor = (id: string) => TILE_COLORS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % TILE_COLORS.length];

function Lists({ view, setView }: { view: string; setView: (v: string) => void }) {
  const music = useMusic();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const card = (id: string, label: string, count: number, color: string, icon: React.ReactNode) => {
    const on = view === id;
    const live = music.source === id && music.playing;
    const ids = id === "all" ? music.songs.map((s) => s.id) : (music.playlists.find((p) => p.id === id)?.songIds ?? []);
    return (
      <div key={id} className={cn("group relative rounded-2xl border p-3 transition-colors duration-150", on ? "border-primary bg-primary/10" : "border-glass-border bg-glass hover:bg-glass-strong")}>
        <button type="button" onClick={() => setView(id)} className="absolute inset-0 z-10 cursor-pointer rounded-2xl" aria-label={`Open ${label}`} aria-pressed={on} />
        <div className={cn("relative grid aspect-[4/3] place-items-center rounded-xl text-white", color)}>
          {icon}
          <Button
            size="icon"
            disabled={!count}
            onClick={() => {
              // Playing this list: pause. Otherwise play it, resuming its song if one was going
              if (live) return music.pause();
              const resume = music.source === id && music.song && ids.includes(music.song.id) ? music.song.id : ids[0];
              music.setSource(id);
              music.play(resume);
            }}
            aria-label={live ? `Pause ${label}` : `Play ${label}`}
            className={cn(
              "absolute right-2 bottom-2 z-20 size-10 rounded-full bg-white text-black shadow-lg transition-[opacity,transform] duration-150 hover:bg-white/90",
              live ? "opacity-100" : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:opacity-100"
            )}
          >
            {live ? <PauseIcon /> : <PlayIcon />}
          </Button>
        </div>
        <p className={cn("mt-3 truncate font-semibold", on && "text-primary")}>{label}</p>
        <p className="text-sm text-muted-foreground">
          {count} {count === 1 ? "song" : "songs"}
          {live && <span className="text-primary">, playing</span>}
        </p>
      </div>
    );
  };

  return (
    <section aria-labelledby="your-lists" className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 id="your-lists" className="text-xl font-semibold">
          Your playlists
        </h2>
        <Button variant="glass" onClick={() => setCreating(true)}>
          <PlusIcon />
          New playlist
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {card("all", "All songs", music.songs.length, "bg-gradient-to-br from-[#0152cb] to-[#4d9cff]", <MusicIcon className="size-8" />)}
        {music.playlists.map((p) => card(p.id, p.name, p.songIds.length, tileColor(p.id), <ListMusicIcon className="size-8" />))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="grid min-h-40 place-items-center rounded-2xl border-2 border-dashed border-glass-border text-muted-foreground transition-colors duration-150 hover:border-primary/50 hover:text-foreground"
        >
          <span className="grid justify-items-center gap-2 text-sm font-medium">
            <PlusIcon className="size-5" />
            New playlist
          </span>
        </button>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="glass border border-glass-border bg-glass-strong sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New playlist</DialogTitle>
            <DialogDescription>A list for a mood, like Rainy focus or Exam week.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const p = music.createPlaylist(name);
              setName("");
              setCreating(false);
              setView(p.id);
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Playlist name" aria-label="Playlist name" maxLength={60} autoFocus className="h-11 rounded-xl" />
            <Button type="submit" disabled={!name.trim()}>
              Create playlist
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ---------- the songs in a list ---------- */

function Tracks({ title, playlistId, songs }: { title: string; playlistId: string | null; songs: Song[] }) {
  const music = useMusic();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const playingHere = music.source === (playlistId ?? "all");

  const playAll = () => {
    music.setSource(playlistId ?? "all");
    if (songs[0]) music.play(songs[0].id);
  };

  return (
    <section aria-label={title} className={groupClass}>
      <div className="flex flex-wrap items-center gap-3 border-b border-glass-divider p-5">
        {renaming && playlistId ? (
          <form
            className="min-w-48 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              music.renamePlaylist(playlistId, draft);
              setRenaming(false);
            }}
          >
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => (music.renamePlaylist(playlistId, draft), setRenaming(false))} autoFocus aria-label="Playlist name" maxLength={60} className="h-10 rounded-lg text-lg font-semibold" />
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">
              {songs.length} {songs.length === 1 ? "song" : "songs"}
            </p>
          </div>
        )}
        {playlistId && <AddSongs playlistId={playlistId} />}
        <Button
          variant="outline"
          disabled={!songs.length}
          onClick={() => {
            music.setSource(playlistId ?? "all");
            music.shufflePlay(songs.map((s) => s.id));
          }}
        >
          <ShuffleIcon />
          Shuffle
        </Button>
        <Button disabled={!songs.length} onClick={playAll}>
          <PlayIcon />
          {playingHere && music.playing ? "Playing" : "Play all"}
        </Button>
        {playlistId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`More for ${title}`} className="text-muted-foreground">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem onSelect={() => (setDraft(title), setRenaming(true))}>
                <PencilIcon />
                Rename playlist
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => music.removePlaylist(playlistId)}>
                <Trash2Icon />
                Delete playlist
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {songs.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground">{playlistId ? "This playlist is empty. Use Add songs to fill it." : "No songs yet."}</p>
      ) : (
        <ol className="p-2">
          {songs.map((s, i) => (
            <TrackRow key={s.id} song={s} index={i} playlistId={playlistId} onPlay={() => (music.setSource(playlistId ?? "all"), music.play(s.id))} />
          ))}
        </ol>
      )}
    </section>
  );
}

function TrackRow({ song, index, playlistId, onPlay }: { song: Song; index: number; playlistId: string | null; onPlay: () => void }) {
  const music = useMusic();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(song.name);
  const active = music.song?.id === song.id;
  const save = () => {
    music.rename(song.id, draft);
    setRenaming(false);
  };

  return (
    <li className={cn("group grid grid-cols-[2rem_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl px-3 py-2", active ? "bg-primary/10" : "hover:bg-foreground/5")}>
      <button type="button" onClick={() => (active ? music.toggle() : onPlay())} aria-label={active && music.playing ? `Pause ${song.name}` : `Play ${song.name}`} className="grid size-8 place-items-center text-sm text-muted-foreground tabular-nums">
        <span className={cn(active ? "hidden" : "group-hover:hidden")}>{index + 1}</span>
        <span className={cn(active ? "block text-primary" : "hidden group-hover:block")}>{active && music.playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}</span>
      </button>
      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save} autoFocus aria-label="Song name" maxLength={80} className="h-8 rounded-lg" />
        </form>
      ) : (
        <span className={cn("truncate", active && "font-medium text-primary")}>{song.name}</span>
      )}
      <span className="hidden text-xs text-muted-foreground tabular-nums sm:block">{formatBytes(song.blob.size)}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`More for ${song.name}`} className="size-8 text-muted-foreground">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => (setDraft(song.name), setRenaming(true))}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          {music.playlists.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                <ListPlusIcon className="size-3.5" />
                Add to playlist
              </DropdownMenuLabel>
              {music.playlists.map((p) => (
                <DropdownMenuCheckboxItem key={p.id} checked={p.songIds.includes(song.id)} onCheckedChange={() => music.toggleInPlaylist(p.id, song.id)} onSelect={(e) => e.preventDefault()}>
                  <span className="truncate">{p.name}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          {playlistId ? (
            <DropdownMenuItem onSelect={() => music.toggleInPlaylist(playlistId, song.id)}>
              <CheckIcon />
              Remove from this playlist
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => music.remove(song.id)}>
              <Trash2Icon />
              Delete song
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/** Add songs: a dialog with a search box; tick songs in or out of the playlist. */
function AddSongs({ playlistId }: { playlistId: string }) {
  const music = useMusic();
  const [open, setOpen] = useState(false);
  const playlist = music.playlists.find((p) => p.id === playlistId);
  if (!playlist) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon />
        Add songs
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass gap-4 border border-glass-border bg-glass-strong sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add songs to {playlist.name}</DialogTitle>
            <DialogDescription>Tick a song to add it, untick to take it out.</DialogDescription>
          </DialogHeader>
          <Command className="rounded-xl border border-border bg-transparent">
            <CommandInput placeholder="Search your songs" />
            <CommandList className="max-h-72">
              <CommandEmpty>{music.songs.length ? "No songs match." : "Upload songs first."}</CommandEmpty>
              <CommandGroup>
                {music.songs.map((s) => {
                  const added = playlist.songIds.includes(s.id);
                  return (
                    <CommandItem key={s.id} value={`${s.name} ${s.id}`} onSelect={() => music.toggleInPlaylist(playlistId, s.id)} className="gap-3 py-2.5">
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", added ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                        {added && <CheckIcon className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{formatBytes(s.blob.size)}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          <Button onClick={() => setOpen(false)}>
            Done ({playlist.songIds.length} {playlist.songIds.length === 1 ? "song" : "songs"})
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- storage and preferences ---------- */

function Storage() {
  const music = useMusic();
  const share = music.used / MAX_LIBRARY_BYTES;
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <div className={`${groupClass} p-5`}>
        <p className="text-sm font-medium">Storage</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
          <div className={cn("h-full rounded-full", share > 0.9 ? "bg-amber-500" : "bg-primary")} style={{ width: `${Math.min(100, Math.max(1, share * 100))}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
          {formatBytes(music.used)} of {formatBytes(MAX_LIBRARY_BYTES)}, {music.songs.length} of {MAX_SONGS} songs. Saved on this device, never uploaded.
        </p>
      </div>
      <label className={`${groupClass} flex items-start justify-between gap-4 p-5`}>
        <span>
          <span className="block text-sm font-medium">Stop when a focus block ends</span>
          <span className="text-xs text-muted-foreground">Music pauses for your break, and when a study session ends.</span>
        </span>
        <Checkbox checked={music.stopOnBreak} onCheckedChange={(v) => music.setStopOnBreak(!!v)} />
      </label>
    </div>
  );
}
