"use client";

import { Suspense, createContext, useContext, useEffect, useRef, useState } from "react";
import { FloatingPlayer } from "@/components/music/music-button";
import {
  addSong,
  deletePlaylist,
  deleteSong,
  listPlaylists,
  listSongs,
  savePlaylist,
  saveSong,
  songProblem,
  type Playlist,
  type Song,
} from "./song-store";

/*
 * One music player for the whole app, so a song keeps playing as you move
 * between Today, subjects, chats and study sessions. It lives in the root
 * layout. What plays is all your songs or one playlist, in order, looping.
 */

const PREFS = "marginalia:music";
type Prefs = { volume: number; source: string; stopOnBreak: boolean };
const DEFAULT_PREFS: Prefs = { volume: 50, source: "all", stopOnBreak: false };

function readPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Items in `now` win over saved ones with the same id (they're newer). */
function mergeById<T extends { id: string }>(now: T[], saved: T[]) {
  const ids = new Set(now.map((x) => x.id));
  return [...now, ...saved.filter((x) => !ids.has(x.id))];
}

type Music = ReturnType<typeof useMusicState>;
const MusicContext = createContext<Music | null>(null);

function useMusicState() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [current, setCurrent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [repeatOne, setRepeatOne] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferences live in this browser
    setPrefs(readPrefs());
    // Merged, not replaced: songs added while the library loads must not be lost
    void listSongs().then((saved) => setSongs((now) => mergeById(now, saved).sort((x, y) => y.addedAt - x.addedAt)));
    void listPlaylists().then((saved) => setPlaylists((now) => mergeById(now, saved).sort((x, y) => x.createdAt - y.createdAt)));
  }, []);

  const updatePrefs = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS, JSON.stringify(next));
      } catch {
        // Preferences are a convenience
      }
      return next;
    });

  // What plays: all songs, or the chosen playlist (in its order)
  const playlist = playlists.find((p) => p.id === prefs.source) ?? null;
  const queue = playlist ? playlist.songIds.map((id) => songs.find((s) => s.id === id)).filter((s): s is Song => !!s) : songs;
  const song = songs.find((s) => s.id === current) ?? null;

  useEffect(() => {
    if (!song) return;
    const next = URL.createObjectURL(song.blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the object URL follows the chosen song
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [song]);

  useEffect(() => {
    if (audio.current) audio.current.volume = prefs.volume / 100;
  }, [prefs.volume, url]);

  const play = (id?: string) => {
    const target = id ?? current ?? queue[0]?.id;
    if (!target) return;
    if (target === current) void audio.current?.play();
    setCurrent(target);
    setPlaying(true);
  };
  const pause = () => audio.current?.pause();
  const toggle = () => (playing ? pause() : play());
  const step = (by: 1 | -1) => {
    if (!queue.length) return;
    const at = queue.findIndex((s) => s.id === current);
    play(queue[(at + by + queue.length) % queue.length].id);
  };

  const used = songs.reduce((n, s) => n + s.blob.size, 0);

  /** Adds the songs that fit the limits; returns how many were added and why the rest weren't. */
  const add = async (files: FileList | File[]) => {
    const added: Song[] = [];
    const rejected: string[] = [];
    let size = used;
    for (const file of [...files]) {
      const problem = songProblem(file, size, songs.length + added.length);
      if (problem) {
        rejected.push(`${file.name} ${problem}.`);
        continue;
      }
      added.push(await addSong(file));
      size += file.size;
    }
    setSongs((list) => [...added, ...list]);
    return { added: added.length, rejected };
  };
  const rename = (id: string, name: string) => {
    const s = songs.find((x) => x.id === id);
    const trimmed = name.trim();
    if (!s || !trimmed) return;
    const updated = { ...s, name: trimmed.slice(0, 80) };
    setSongs((list) => list.map((x) => (x.id === id ? updated : x)));
    void saveSong(updated);
  };
  const remove = (id: string) => {
    if (id === current) {
      pause();
      setCurrent(null);
      setUrl(null);
    }
    setSongs((list) => list.filter((x) => x.id !== id));
    void deleteSong(id);
    // Playlists drop it too
    for (const p of playlists.filter((p) => p.songIds.includes(id))) savePl({ ...p, songIds: p.songIds.filter((x) => x !== id) });
  };

  const savePl = (p: Playlist) => {
    setPlaylists((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]));
    void savePlaylist(p);
  };
  const createPlaylist = (name: string) => {
    const p: Playlist = { id: crypto.randomUUID(), name: name.trim().slice(0, 60) || "Playlist", songIds: [], createdAt: Date.now() };
    savePl(p);
    return p;
  };
  const renamePlaylist = (id: string, name: string) => {
    const p = playlists.find((x) => x.id === id);
    if (p && name.trim()) savePl({ ...p, name: name.trim().slice(0, 60) });
  };
  const removePlaylist = (id: string) => {
    setPlaylists((list) => list.filter((x) => x.id !== id));
    void deletePlaylist(id);
    if (prefs.source === id) updatePrefs({ source: "all" });
  };
  const toggleInPlaylist = (playlistId: string, songId: string) => {
    const p = playlists.find((x) => x.id === playlistId);
    if (!p) return;
    savePl({ ...p, songIds: p.songIds.includes(songId) ? p.songIds.filter((x) => x !== songId) : [...p.songIds, songId] });
  };

  const element = url ? (
    <audio
      ref={audio}
      src={url}
      autoPlay={playing}
      loop={repeatOne || queue.length <= 1}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => step(1)}
    />
  ) : null;

  return {
    songs,
    used,
    playlists,
    queue,
    song,
    playing,
    repeatOne,
    setRepeatOne,
    volume: prefs.volume,
    setVolume: (volume: number) => updatePrefs({ volume }),
    source: playlist ? playlist.id : "all",
    setSource: (source: string) => updatePrefs({ source }),
    stopOnBreak: prefs.stopOnBreak,
    setStopOnBreak: (stopOnBreak: boolean) => updatePrefs({ stopOnBreak }),
    play,
    pause,
    toggle,
    step,
    add,
    rename,
    remove,
    createPlaylist,
    renamePlaylist,
    removePlaylist,
    toggleInPlaylist,
    element,
  };
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const music = useMusicState();
  return (
    <MusicContext.Provider value={music}>
      {children}
      {music.element}
      {/* It reads the URL, so it waits for it */}
      <Suspense>
        <FloatingPlayer />
      </Suspense>
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const music = useContext(MusicContext);
  if (!music) throw new Error("useMusic needs a MusicProvider");
  return music;
}
