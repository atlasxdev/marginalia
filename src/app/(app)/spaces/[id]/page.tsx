import { Suspense } from "react";
import type { Metadata } from "next";
import { SpaceView } from "@/components/space-view";

export const metadata: Metadata = { title: "Subject" };

export default function SpacePage({ params }: PageProps<"/spaces/[id]">) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <SpaceView key={id} id={id} />
      ))}
    </Suspense>
  );
}
