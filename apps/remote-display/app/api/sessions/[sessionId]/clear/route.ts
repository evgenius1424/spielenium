import { NextRequest } from "next/server";
import { clearContent, getSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  try {
    await clearContent(session);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error clearing content:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
