import type { Metadata } from "next";
import { PlaylistsView } from "@/components/music/playlists-view";

export const metadata: Metadata = { title: "Playlists" };

export default function PlaylistsPage() {
  return <PlaylistsView />;
}
