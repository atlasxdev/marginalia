import { addAssistantMessage, getConversation, mockAnswer } from "@/server/mock-store";

// Streams the answer to the conversation's latest unanswered question.
// Protocol: first line is JSON `{ "sources": [...] }`, the rest is the answer text.
export async function POST(_req: Request, ctx: RouteContext<"/api/conversations/[id]/answer">) {
  const { id } = await ctx.params;
  const conversation = await getConversation(id);
  if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });

  const last = conversation.messages.at(-1);
  if (!last || last.role !== "user") {
    return Response.json({ error: "Nothing to answer." }, { status: 409 });
  }

  const answer = mockAnswer(last.content);
  if (answer === "quota") {
    return Response.json(
      { error: "Daily question limit reached. Try again tomorrow." },
      { status: 429 }
    );
  }

  const encoder = new TextEncoder();
  const tokens = answer.text.match(/\S+\s*/g) ?? [];

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(JSON.stringify({ sources: answer.sources }) + "\n"));
      await new Promise((r) => setTimeout(r, 500)); // retrieval
      for (const token of tokens) {
        controller.enqueue(encoder.encode(token));
        await new Promise((r) => setTimeout(r, 28));
      }
      await addAssistantMessage(id, answer.text, answer.sources);
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
