import { Suspense } from "react";
import type { Metadata } from "next";
import { ExamDetailView } from "@/components/exam-detail";

export const metadata: Metadata = { title: "Event" };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <ExamDetailView key={id} id={id} />
      ))}
    </Suspense>
  );
}
