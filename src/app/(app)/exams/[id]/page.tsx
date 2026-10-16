import { Suspense } from "react";
import type { Metadata } from "next";
import { ExamDetailView } from "@/components/exam-detail";

export const metadata: Metadata = { title: "Exam" };

export default function ExamPage({ params }: PageProps<"/exams/[id]">) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <ExamDetailView key={id} id={id} />
      ))}
    </Suspense>
  );
}
