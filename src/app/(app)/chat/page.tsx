import { redirect } from "next/navigation";

// Questions are asked inside a subject now, so a bare /chat goes to Today
export default function ChatPage() {
  redirect("/study");
}
