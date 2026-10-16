import type { Metadata } from "next";
import { ExamsView } from "@/components/exams-view";

export const metadata: Metadata = { title: "Exams" };

export default function ExamsPage() {
  return <ExamsView />;
}
