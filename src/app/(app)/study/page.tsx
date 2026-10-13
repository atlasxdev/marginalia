import type { Metadata } from "next";
import { StudyHub } from "@/components/study-hub";

export const metadata: Metadata = { title: "Today" };

export default function StudyPage() {
  return <StudyHub />;
}
