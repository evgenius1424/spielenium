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

const IMAGE_FORMATS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
const VIDEO_FORMATS = [".mp4", ".webm", ".mov", ".avi"];
const SUPPORTED_FORMATS = new Set([...IMAGE_FORMATS, ...VIDEO_FORMATS]);

type RouteParams = { params: Promise<{ sessionId: string }> };
type ContentItemInput = Omit<ContentItem, "id" | "uploadedAt">;
type UploadData = { items: { name: string; url: string }[] };

export async function GET(_request: NextRequest, { params }: RouteParams) {
    const { sessionId } = await params;
    const session = await getSession(sessionId);

    if (!session) {
        return NextResponse.json([]);
    }

    return NextResponse.json(Array.from(session.contentLibrary.values()));
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    const { sessionId } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const session = await getOrCreateSession(sessionId);
    if (!session) {
        return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    await clearAllContent(session);

    const contentItems = await parseUploadedFile(file);
    if (!contentItems) {
        return NextResponse.json(
            { error: "Unsupported file type. Please upload a ZIP or JSON file." },
            { status: 400 }
        );
    }

    const addedItems = await addContentItems(session, sessionId, contentItems);
    broadcastContentList(session);

    return NextResponse.json({
        success: true,
        contentCount: addedItems.length,
        items: addedItems,
    });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const { sessionId } = await params;
    const session = await getSession(sessionId);

    if (session) {
        await cleanupTempFiles(session);
        await clearAllContent(session);
    }

    return NextResponse.json({ success: true });
}

async function getOrCreateSession(sessionId: string) {
    let session = await getSession(sessionId);
    if (!session) {
        await createSession(sessionId);
        session = await getSession(sessionId);
    }
    return session;
}

async function parseUploadedFile(file: File): Promise<ContentItemInput[] | null> {
    if (file.type === "application/zip" || file.name.endsWith(".zip")) {
        return processZipFile(file);
    }
    if (file.type === "application/json" || file.name.endsWith(".json")) {
        return processJsonFile(file);
    }
    return null;
}

async function processZipFile(file: File): Promise<ContentItemInput[]> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);
    const tempDir = join(tmpdir(), "remote-display", Date.now().toString());
    await mkdir(tempDir, { recursive: true });

    const items: ContentItemInput[] = [];

    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;

        const fileName = entry.entryName.split("/").pop() || entry.entryName;
        const ext = getExtension(fileName);

        if (!SUPPORTED_FORMATS.has(ext)) continue;

        const entryDir = entry.entryName.includes("/")
            ? join(tempDir, entry.entryName.substring(0, entry.entryName.lastIndexOf("/")))
            : tempDir;

        await mkdir(entryDir, { recursive: true });
        const tempFilePath = join(entryDir, fileName);

        try {
            await writeFile(tempFilePath, entry.getData());
            items.push({
                name: getNameWithoutExtension(fileName),
                type: IMAGE_FORMATS.includes(ext) ? "image" : "video",
                url: tempFilePath,
                size: entry.header.size,
            });
        } catch {
            // Skip files that fail to write
        }
    }

    return items;
}

async function processJsonFile(file: File): Promise<ContentItemInput[]> {
    const data: UploadData = JSON.parse(await file.text());

    return data.items
        .filter((item) => {
            const url = item.url.toLowerCase();
            return [...IMAGE_FORMATS, ...VIDEO_FORMATS].some((ext) => url.includes(ext));
        })
        .map((item) => {
            const isImage = IMAGE_FORMATS.some((ext) => item.url.toLowerCase().includes(ext));
            return {
                name: item.name,
                type: isImage ? "image" : "video",
                url: item.url,
                size: 0,
            } as ContentItemInput;
        });
}

async function addContentItems(
    session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
    sessionId: string,
    items: ContentItemInput[]
): Promise<ContentItem[]> {
    const addedItems: ContentItem[] = [];

    for (const item of items) {
        const itemWithOriginalPath = {
            ...item,
            originalPath: !item.url.startsWith("http") ? item.url : undefined,
        };

        const addedItem = await addContent(session, itemWithOriginalPath);

        if (!item.url.startsWith("http")) {
            const updatedItem = {
                ...addedItem,
                url: `/api/sessions/${sessionId}/content/${addedItem.id}`,
                thumbnail: `/api/sessions/${sessionId}/content/${addedItem.id}`,
            };
            session.contentLibrary.set(addedItem.id, updatedItem);
            addedItems.push(updatedItem);
        } else {
            addedItems.push(addedItem);
        }
    }

    return addedItems;
}

function broadcastContentList(
    session: NonNullable<Awaited<ReturnType<typeof getSession>>>
) {
    const payload = Array.from(session.contentLibrary.values());
    for (const subscriber of session.subscribers) {
        try {
            subscriber({ type: "content-list", payload });
        } catch {
            // Ignore subscriber errors
        }
    }
}

async function cleanupTempFiles(
    session: NonNullable<Awaited<ReturnType<typeof getSession>>>
) {
    const dirsToRemove = new Set<string>();

    for (const item of session.contentLibrary.values()) {
        if (item.originalPath?.startsWith("/tmp") || item.originalPath?.includes("temp")) {
            const dirPath = item.originalPath.substring(0, item.originalPath.lastIndexOf("/"));
            dirsToRemove.add(dirPath);
        }
    }

    await Promise.all(
        Array.from(dirsToRemove).map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {}))
    );
}

function getExtension(fileName: string): string {
    return fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
}

function getNameWithoutExtension(fileName: string): string {
    return fileName.substring(0, fileName.lastIndexOf("."));
}