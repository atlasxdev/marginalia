import type { Metadata } from "next";
import { NewQuestion } from "@/components/new-question";

export const metadata: Metadata = { title: "New question" };

export default function ChatPage() {
  return <NewQuestion />;
}
