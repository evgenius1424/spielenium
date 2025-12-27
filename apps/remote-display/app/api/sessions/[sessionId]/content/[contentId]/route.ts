import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/sessions";

type RouteParams = {
  params: Promise<{ sessionId: string; contentId: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { sessionId, contentId } = await params;

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const content = session.contentLibrary.get(contentId);
  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  // For URL content (from JSON files), redirect to the URL
  if (content.data.startsWith("http")) {
    return NextResponse.redirect(content.data);
  }

  // For base64 content, decode and serve with proper Content-Type
  try {
    const buffer = Buffer.from(content.data, "base64");

    return new Response(buffer, {
      headers: {
        "Content-Type": content.mimeType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to decode content" },
      { status: 500 },
    );
  }
}
