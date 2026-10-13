/*
 * Your music library, kept in this browser (IndexedDB) so it's there every
 * time. Songs never leave the device. Playlists are named lists of songs.
 */

export type Song = { id: string; name: string; blob: Blob; addedAt: number };
export type Playlist = { id: string; name: string; songIds: string[]; createdAt: number };

const DB = "marginalia-music";
const SONGS = "songs";
const PLAYLISTS = "playlists";
const MB = 1024 * 1024;
export const MAX_SONG_BYTES = 20 * MB;
export const MAX_LIBRARY_BYTES = 300 * MB;
export const MAX_SONGS = 50;

/** The audio formats that play in every modern browser. */
const SONG_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/wave", "audio/ogg"];
const EXTENSIONS = ["mp3", "m4a", "aac", "wav", "ogg"];
export const SONG_ACCEPT = [...SONG_TYPES, ...EXTENSIONS.map((e) => `.${e}`)].join(",");
export const SONG_FORMATS_LABEL = "MP3, M4A, AAC, WAV or OGG";

export const formatBytes = (bytes: number) =>
  bytes >= MB ? `${(bytes / MB).toFixed(bytes >= 10 * MB ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Why a file can't be added, or null if it can. `used` is the library's size so far, `count` its songs. */
export function songProblem(file: File, used: number, count: number): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!SONG_TYPES.includes(file.type) && !EXTENSIONS.includes(ext)) return `isn't a supported format (${SONG_FORMATS_LABEL})`;
  if (file.size > MAX_SONG_BYTES) return `is ${formatBytes(file.size)}; songs can be up to ${formatBytes(MAX_SONG_BYTES)}`;
  if (count >= MAX_SONGS) return `didn't fit: your library holds up to ${MAX_SONGS} songs`;
  if (used + file.size > MAX_LIBRARY_BYTES) return `didn't fit: your library holds up to ${formatBytes(MAX_LIBRARY_BYTES)}`;
  return null;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SONGS)) db.createObjectStore(SONGS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PLAYLISTS)) db.createObjectStore(PLAYLISTS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = work(db.transaction(store, mode).objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

const safely = async <T,>(work: () => Promise<T>, fallback: T) => {
  try {
    return await work();
  } catch {
    // Private windows can block storage: the library is empty, but songs still play this time
    return fallback;
  }
};

export const listSongs = () =>
  safely(async () => (await run<Song[]>(SONGS, "readonly", (s) => s.getAll() as IDBRequest<Song[]>)).sort((a, b) => b.addedAt - a.addedAt), []);

export const listPlaylists = () =>
  safely(async () => (await run<Playlist[]>(PLAYLISTS, "readonly", (s) => s.getAll() as IDBRequest<Playlist[]>)).sort((a, b) => a.createdAt - b.createdAt), []);

export async function addSong(file: File): Promise<Song> {
  const song: Song = { id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ""), blob: file, addedAt: Date.now() };
  await safely(() => run(SONGS, "readwrite", (s) => s.put(song)), undefined);
  return song;
}

export const saveSong = (song: Song) => safely(() => run(SONGS, "readwrite", (s) => s.put(song)), undefined);
export const deleteSong = (id: string) => safely(() => run(SONGS, "readwrite", (s) => s.delete(id)), undefined);
export const savePlaylist = (playlist: Playlist) => safely(() => run(PLAYLISTS, "readwrite", (s) => s.put(playlist)), undefined);
export const deletePlaylist = (id: string) => safely(() => run(PLAYLISTS, "readwrite", (s) => s.delete(id)), undefined);
