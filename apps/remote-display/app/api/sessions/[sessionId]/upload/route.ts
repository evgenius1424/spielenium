import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  addContent,
  clearAllContent,
  ContentItem,
  createSession,
  getSession,
} from "@/lib/sessions";

type UploadData = {
  items: { name: string; url: string }[];
};

const supportedImageFormats = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
];
const supportedVideoFormats = [".mp4", ".webm", ".mov", ".avi"];

async function processZipFile(
  file: File,
): Promise<Omit<ContentItem, "id" | "uploadedAt">[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const contentItems: Omit<ContentItem, "id" | "uploadedAt">[] = [];

  const tempDir = join(tmpdir(), "remote-display", Date.now().toString());
  await mkdir(tempDir, { recursive: true });

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const fullPath = entry.entryName;
    const fileName = fullPath.split("/").pop() || fullPath; // Get just the filename, not the full path
    const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();

    if (
      !supportedImageFormats.includes(ext) &&
      !supportedVideoFormats.includes(ext)
    ) {
      continue;
    }

    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf("."));
    const isImage = supportedImageFormats.includes(ext);

    // Create subdirectory if needed and use original filename
    const entryDir = fullPath.includes("/")
      ? join(tempDir, fullPath.substring(0, fullPath.lastIndexOf("/")))
      : tempDir;
    await mkdir(entryDir, { recursive: true });
    const tempFilePath = join(entryDir, fileName);

    try {
      await writeFile(tempFilePath, entry.getData());
    } catch (writeError) {
      console.error(`Failed to write file ${fileName}:`, writeError);
      continue; // Skip this file if we can't write it
    }

    contentItems.push({
      name: nameWithoutExt,
      type: isImage ? "image" : "video",
      url: tempFilePath,
      size: entry.header.size,
    });
  }

  return contentItems;
}

async function processJsonFile(
  file: File,
): Promise<Omit<ContentItem, "id" | "uploadedAt">[]> {
  const text = await file.text();
  const data: UploadData = JSON.parse(text);
  const contentItems: Omit<ContentItem, "id" | "uploadedAt">[] = [];

  for (const item of data.items) {
    const url = item.url.toLowerCase();
    const isImage = supportedImageFormats.some((ext) => url.includes(ext));
    const isVideo = supportedVideoFormats.some((ext) => url.includes(ext));

    if (!isImage && !isVideo) continue;

    contentItems.push({
      name: item.name,
      type: isImage ? "image" : "video",
      url: item.url,
      size: 0,
    });
  }

  return contentItems;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Get or create session
    console.log(`Upload: Looking for session ${sessionId}`);

    // Check what sessions exist before creating
    const { getAllSessions } = await import("@/lib/sessions");
    let allSessions = await getAllSessions();
    console.log(
      `Upload: Sessions before creation:`,
      allSessions.map((s) => s.id),
    );

    let session = await getSession(sessionId);
    if (!session) {
      console.log(`Upload: Session ${sessionId} not found, creating it`);
      try {
        await createSession(sessionId);
        session = await getSession(sessionId);

        // Check sessions after creation
        allSessions = await getAllSessions();
        console.log(
          `Upload: Sessions after creation:`,
          allSessions.map((s) => s.id),
        );

        if (!session) {
          return NextResponse.json(
            { error: "Failed to create session" },
            { status: 500 },
          );
        }
        console.log(`Upload: Session ${sessionId} created successfully`);
      } catch (error) {
        console.error("Session creation error:", error);
        return NextResponse.json(
          {
            error:
              "Failed to create session: " +
              (error instanceof Error ? error.message : "Unknown error"),
          },
          { status: 500 },
        );
      }
    } else {
      console.log(`Upload: Found existing session ${sessionId}`);
    }

    // Clear existing content as required
    await clearAllContent(session);

    console.log(
      `Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`,
    );

    let contentItems: Omit<ContentItem, "id" | "uploadedAt">[] = [];

    try {
      if (file.type === "application/zip" || file.name.endsWith(".zip")) {
        console.log("Processing as ZIP file");
        contentItems = await processZipFile(file);
      } else if (
        file.type === "application/json" ||
        file.name.endsWith(".json")
      ) {
        console.log("Processing as JSON file");
        contentItems = await processJsonFile(file);
      } else {
        return NextResponse.json(
          { error: "Unsupported file type. Please upload a ZIP or JSON file." },
          { status: 400 },
        );
      }

      console.log(`Processed ${contentItems.length} content items`);
    } catch (fileError) {
      console.error("File processing error:", fileError);
      return NextResponse.json(
        {
          error:
            "Failed to process file: " +
            (fileError instanceof Error ? fileError.message : "Unknown error"),
        },
        { status: 500 },
      );
    }

    // Add all content items to the session
    const addedItems: ContentItem[] = [];
    for (const item of contentItems) {
      // First add the item to get the generated ID
      const itemWithOriginalPath = {
        ...item,
        originalPath: !item.url.startsWith("http") ? item.url : undefined,
      };

      const addedItem = await addContent(session, itemWithOriginalPath);

      // Now update the URLs in the session library directly
      if (!item.url.startsWith("http")) {
        const updatedItem = {
          ...addedItem,
          url: `/api/sessions/${sessionId}/content/${addedItem.id}`,
          thumbnail: `/api/sessions/${sessionId}/content/${addedItem.id}`,
        };

        // Update the item in the session library
        session.contentLibrary.set(addedItem.id, updatedItem);
        addedItems.push(updatedItem);
      } else {
        addedItems.push(addedItem);
      }
    }

    // Final debugging to see session state
    console.log(
      `Upload: Final session state - ID: ${session.id}, content count: ${session.contentLibrary.size}`,
    );
    console.log(
      `Upload: Final content items:`,
      Array.from(session.contentLibrary.keys()),
    );

    // Verify the session still exists
    const finalAllSessions = await getAllSessions();
    console.log(
      `Upload: Final sessions in memory:`,
      finalAllSessions.map((s) => s.id),
    );

    // Broadcast the updated content list with correct URLs
    // Note: broadcast is a private function, but the addContent already broadcasted
    // We just need to broadcast again with the updated URLs
    for (const subscriber of session.subscribers) {
      try {
        subscriber({
          type: "content-list",
          payload: Array.from(session.contentLibrary.values()),
        });
      } catch (error) {
        // Ignore subscriber errors
      }
    }

    return NextResponse.json({
      success: true,
      contentCount: addedItems.length,
      items: addedItems,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json([]);
  }

  const contentItems = Array.from(session.contentLibrary.values());
  return NextResponse.json(contentItems);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);

  if (session) {
    const contentItems = Array.from(session.contentLibrary.values());

    // Clean up temp files
    for (const item of contentItems) {
      if (
        item.originalPath &&
        (item.originalPath.startsWith("/tmp") ||
          item.originalPath.includes("temp"))
      ) {
        try {
          const dirPath = item.originalPath.substring(
            0,
            item.originalPath.lastIndexOf("/"),
          );
          await rm(dirPath, { recursive: true, force: true });
        } catch (error) {
          console.error("Failed to clean up temp file:", error);
        }
      }
    }

    await clearAllContent(session);
  }

  return NextResponse.json({ success: true });
}
