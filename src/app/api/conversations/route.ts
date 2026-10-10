import { listConversations } from "@/server/mock-store";

export async function GET() {
  return Response.json(await listConversations());
}
