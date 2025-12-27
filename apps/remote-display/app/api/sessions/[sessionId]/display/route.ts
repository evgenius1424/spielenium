import { NextRequest, NextResponse } from "next/server";
import { getSession, selectContent, clearDisplay } from "@/lib/sessions";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ sessionId: string }> };

// POST: select content to display
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { contentId } = await request.json();

  if (!contentId) {
    return NextResponse.json(
      { error: "Content ID is required" },
      { status: 400 },
    );
  }

  const success = selectContent(session, contentId);

  if (!success) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// DELETE: clear display
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  clearDisplay(session);
  return NextResponse.json({ success: true });
}
