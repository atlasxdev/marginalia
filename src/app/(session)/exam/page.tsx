import { Suspense } from "react";
import type { Metadata } from "next";
import { ExamView } from "@/components/exam/exam-view";

export const metadata: Metadata = { title: "Practice exam" };

export default function ExamPage() {
  return (
    <Suspense>
      <ExamView />
    </Suspense>
  );
}
