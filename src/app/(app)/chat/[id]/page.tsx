import { Suspense } from "react";
import { ConversationView } from "@/components/conversation-view";

export default function ConversationPage({ params }: PageProps<"/chat/[id]">) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <ConversationView key={id} id={id} />
      ))}
    </Suspense>
  );
}
