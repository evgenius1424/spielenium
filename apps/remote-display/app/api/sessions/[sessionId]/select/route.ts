import { NextRequest } from "next/server";
import { getSession, selectContent } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  console.log(`Select request for session: ${sessionId}`);

  // Check what sessions exist
  const { getAllSessions } = await import("@/lib/sessions");
  const allSessions = await getAllSessions();
  console.log(
    `All sessions:`,
    allSessions.map((s) => s.id),
  );

  const session = await getSession(sessionId);

  if (!session) {
    console.log(`Session not found: ${sessionId}`);
    return new Response("Session not found", { status: 404 });
  }

  console.log(`Session found: ${sessionId}`);

  try {
    const body = await req.json();
    const { contentId } = body;

    if (!contentId) {
      return new Response("Content ID is required", { status: 400 });
    }

    const success = await selectContent(session, contentId);

    if (!success) {
      return new Response("Content not found", { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error selecting content:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
