import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateSession,
  getSession,
  addContent,
  clearContent,
  type ContentItemPublic,
} from "@/lib/sessions";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ sessionId: string }> };

// Helper function to convert ContentItem to public version
function toPublicContentItem(item: any): ContentItemPublic {
  const { data, ...rest } = item;
  return rest;
}

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

  const publicItems = Array.from(session.contentLibrary.values()).map(toPublicContentItem);
  return NextResponse.json(publicItems);
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

    // Add new content (which handles clearing internally)
    await addContent(session, file);

    // Return updated content list
    const publicItems = Array.from(session.contentLibrary.values()).map(toPublicContentItem);
    return NextResponse.json({
      success: true,
      contentCount: publicItems.length,
      items: publicItems,
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