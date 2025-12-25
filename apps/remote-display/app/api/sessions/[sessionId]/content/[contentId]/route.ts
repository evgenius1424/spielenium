import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getSession } from "@/lib/sessions";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
};

type RouteParams = {
  params: Promise<{ sessionId: string; contentId: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { sessionId, contentId } = await params;

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const content = session.contentLibrary.get(contentId);
  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  if (content.url.startsWith("http")) {
    return NextResponse.redirect(content.url);
  }

  const filePath = content.originalPath || content.url;

  try {
    const fileBuffer = await readFile(filePath);
    return new NextResponse(Uint8Array.from(fileBuffer), {
      headers: {
        "Content-Type": getContentType(filePath),
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

function getContentType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}
