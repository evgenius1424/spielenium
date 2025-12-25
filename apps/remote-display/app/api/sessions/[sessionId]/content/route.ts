import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateSession,
  getSession,
  addContent,
  clearContent,
} from "@/lib/sessions";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ sessionId: string }> };

// GET: return content list as JSON
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json([]);
  }

  return NextResponse.json(Array.from(session.contentLibrary.values()));
}

// POST: upload file (ZIP or JSON), returns new content list
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const { sessionId } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const session = getOrCreateSession(sessionId);

    // Clear existing content first (as per original behavior)
    clearContent(session);

    // Add new content
    await addContent(session, file);

    // Return updated content list
    const contentList = Array.from(session.contentLibrary.values());
    return NextResponse.json({
      success: true,
      contentCount: contentList.length,
      items: contentList,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE: clear all content
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (session) {
    clearContent(session);
  }

  return NextResponse.json({ success: true });
}