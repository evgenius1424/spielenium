import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getSession } from "@/lib/sessions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; contentId: string }> },
) {
  try {
    const { sessionId, contentId } = await params;

    console.log(
      `Content request: sessionId=${sessionId}, contentId=${contentId}`,
    );

    // Let's also check what sessions exist
    const { getAllSessions } = await import("@/lib/sessions");
    const allSessions = await getAllSessions();
    console.log(
      `All sessions:`,
      allSessions.map((s) => ({
        id: s.id,
        contentCount: s.contentLibrary.size,
      })),
    );

    const session = await getSession(sessionId);
    if (!session) {
      console.log(`Session not found: ${sessionId}`);
      console.log(
        `Available sessions:`,
        allSessions.map((s) => s.id),
      );
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    console.log(
      `Session found, content library has ${session.contentLibrary.size} items`,
    );
    console.log(
      `Available content IDs:`,
      Array.from(session.contentLibrary.keys()),
    );

    const content = session.contentLibrary.get(contentId);
    if (!content) {
      console.log(`Content not found: ${contentId}`);
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    console.log(`Content found:`, {
      id: content.id,
      name: content.name,
      url: content.url,
      originalPath: content.originalPath,
    });

    // If it's a URL (from JSON upload), redirect to the URL
    if (content.url.startsWith("http")) {
      return NextResponse.redirect(content.url);
    }

    // For local files, serve the file content using originalPath
    const filePath = content.originalPath || content.url;
    try {
      const fileBuffer = await readFile(filePath);

      // Determine content type based on file extension
      const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
      let contentType = "application/octet-stream";

      switch (ext) {
        case ".jpg":
        case ".jpeg":
          contentType = "image/jpeg";
          break;
        case ".png":
          contentType = "image/png";
          break;
        case ".gif":
          contentType = "image/gif";
          break;
        case ".webp":
          contentType = "image/webp";
          break;
        case ".bmp":
          contentType = "image/bmp";
          break;
        case ".mp4":
          contentType = "video/mp4";
          break;
        case ".webm":
          contentType = "video/webm";
          break;
        case ".mov":
          contentType = "video/quicktime";
          break;
        case ".avi":
          contentType = "video/x-msvideo";
          break;
      }

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000",
        },
      });
    } catch (fileError) {
      console.error("File read error:", fileError);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Content serving error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
