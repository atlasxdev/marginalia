import { Suspense } from "react";
import type { Metadata } from "next";
import { DocumentEditor } from "@/components/document-editor";

export const metadata: Metadata = { title: "Edit document" };

export default function EditDocumentPage({ params }: PageProps<"/library/[id]">) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <DocumentEditor key={id} id={id} />
      ))}
    </Suspense>
  );
}
