import type { Metadata } from "next";
import { DocumentEditor } from "@/components/document-editor";

export const metadata: Metadata = { title: "New document" };

export default function NewDocumentPage() {
  return <DocumentEditor />;
}
