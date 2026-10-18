import type { Metadata } from "next";
import { ExamsView } from "@/components/exams-view";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return <ExamsView />;
}
