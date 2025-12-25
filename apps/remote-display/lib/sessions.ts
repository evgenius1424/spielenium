import { randomUUID } from "crypto";
import AdmZip from "adm-zip";

export type ContentItem = {
  id: string;
  name: string;
  type: "image" | "video";
  data: string; // base64 encoded
  mimeType: string;
  size: number;
  uploadedAt: Date;
};

export type Session = {
  id: string;
  contentLibrary: Map<string, ContentItem>;
  currentlyDisplayed: string | null;
  subscribers: Set<(event: SSEEvent) => void>;
  lastActivity: Date;
};

export type SSEEvent =
  | { type: "session-state"; payload: SessionStatePayload }
  | { type: "content-list"; payload: ContentItem[] }
  | { type: "content-selected"; payload: { type: string; url: string; name: string } }
  | { type: "content-cleared"; payload: {} };

export type SessionStatePayload = {
  id: string;
  hasContent: boolean;
  currentlyDisplayed: string | null;
  connectedDevices: number;
};

// Constants
const IMAGE_FORMATS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
const VIDEO_FORMATS = [".mp4", ".webm", ".mov", ".avi"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_SESSION_SIZE = 200 * 1024 * 1024; // 200MB

// In-memory storage
const sessions = new Map<string, Session>();
const cleanupTimers = new Map<string, NodeJS.Timeout>();

// Session management
export function getOrCreateSession(sessionId: string): Session {
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      contentLibrary: new Map(),
      currentlyDisplayed: null,
      subscribers: new Set(),
      lastActivity: new Date(),
    };
    sessions.set(sessionId, session);
    cancelCleanup(sessionId);
  }
  session.lastActivity = new Date();
  return session;
}

export function getSession(sessionId: string): Session | undefined {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
  }
  return session;
}

// Subscription management
export function subscribe(session: Session, callback: (event: SSEEvent) => void): () => void {
  session.subscribers.add(callback);
  session.lastActivity = new Date();
  cancelCleanup(session.id);

  // Send initial state
  const sessionState: SessionStatePayload = {
    id: session.id,
    hasContent: session.contentLibrary.size > 0,
    currentlyDisplayed: session.currentlyDisplayed,
    connectedDevices: session.subscribers.size,
  };

  callback({ type: "session-state", payload: sessionState });
  callback({ type: "content-list", payload: Array.from(session.contentLibrary.values()) });

  // Return unsubscribe function
  return () => {
    session.subscribers.delete(callback);
    session.lastActivity = new Date();

    // Schedule cleanup if no subscribers remain
    if (session.subscribers.size === 0) {
      scheduleCleanup(session.id);
    }
  };
}

export function broadcast(session: Session, event: SSEEvent): void {
  session.lastActivity = new Date();
  for (const callback of session.subscribers) {
    try {
      callback(event);
    } catch (error) {
      // Ignore subscriber errors
    }
  }
}

// Content management
export async function addContent(session: Session, file: File): Promise<ContentItem> {
  session.lastActivity = new Date();

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(MAX_FILE_SIZE)})`);
  }

  // Check session size limit
  const currentSize = Array.from(session.contentLibrary.values())
    .reduce((total, item) => total + item.size, 0);
  if (currentSize + file.size > MAX_SESSION_SIZE) {
    throw new Error(`Session size would exceed maximum allowed size (${formatFileSize(MAX_SESSION_SIZE)})`);
  }

  // Process file based on type
  if (file.name.endsWith(".zip") || file.type === "application/zip") {
    return await processZipFile(session, file);
  } else if (file.name.endsWith(".json") || file.type === "application/json") {
    return await processJsonFile(session, file);
  } else {
    throw new Error("Unsupported file type. Only ZIP and JSON files are allowed.");
  }
}

export function clearContent(session: Session): void {
  session.lastActivity = new Date();
  session.contentLibrary.clear();
  session.currentlyDisplayed = null;

  const sessionState: SessionStatePayload = {
    id: session.id,
    hasContent: false,
    currentlyDisplayed: null,
    connectedDevices: session.subscribers.size,
  };

  broadcast(session, { type: "content-list", payload: [] });
  broadcast(session, { type: "content-cleared", payload: {} });
  broadcast(session, { type: "session-state", payload: sessionState });
}

export function selectContent(session: Session, contentId: string): boolean {
  session.lastActivity = new Date();
  const content = session.contentLibrary.get(contentId);
  if (!content) {
    return false;
  }

  session.currentlyDisplayed = contentId;

  const sessionState: SessionStatePayload = {
    id: session.id,
    hasContent: session.contentLibrary.size > 0,
    currentlyDisplayed: contentId,
    connectedDevices: session.subscribers.size,
  };

  broadcast(session, {
    type: "content-selected",
    payload: {
      type: content.type,
      url: `/api/sessions/${session.id}/content/${contentId}`,
      name: content.name,
    },
  });
  broadcast(session, { type: "session-state", payload: sessionState });

  return true;
}

export function clearDisplay(session: Session): void {
  session.lastActivity = new Date();
  session.currentlyDisplayed = null;

  const sessionState: SessionStatePayload = {
    id: session.id,
    hasContent: session.contentLibrary.size > 0,
    currentlyDisplayed: null,
    connectedDevices: session.subscribers.size,
  };

  broadcast(session, { type: "content-cleared", payload: {} });
  broadcast(session, { type: "session-state", payload: sessionState });
}

// File processing helpers
async function processZipFile(session: Session, file: File): Promise<ContentItem> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  let processedCount = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const fileName = entry.entryName.split("/").pop() || entry.entryName;
    const ext = getExtension(fileName);

    if (!isValidContentFormat(ext)) continue;

    const entryData = entry.getData();
    const base64Data = entryData.toString("base64");
    const mimeType = getMimeType(ext);

    const contentItem: ContentItem = {
      id: randomUUID(),
      name: getNameWithoutExtension(fileName),
      type: IMAGE_FORMATS.includes(ext) ? "image" : "video",
      data: base64Data,
      mimeType,
      size: entryData.length,
      uploadedAt: new Date(),
    };

    session.contentLibrary.set(contentItem.id, contentItem);
    processedCount++;
  }

  // Broadcast updated content list
  const sessionState: SessionStatePayload = {
    id: session.id,
    hasContent: session.contentLibrary.size > 0,
    currentlyDisplayed: session.currentlyDisplayed,
    connectedDevices: session.subscribers.size,
  };

  broadcast(session, { type: "content-list", payload: Array.from(session.contentLibrary.values()) });
  broadcast(session, { type: "session-state", payload: sessionState });

  // Return a dummy content item representing the batch upload
  return {
    id: "batch-upload",
    name: `${processedCount} files uploaded`,
    type: "image",
    data: "",
    mimeType: "text/plain",
    size: file.size,
    uploadedAt: new Date(),
  };
}

async function processJsonFile(session: Session, file: File): Promise<ContentItem> {
  const jsonText = await file.text();
  const data = JSON.parse(jsonText);

  if (!data.items || !Array.isArray(data.items)) {
    throw new Error("JSON file must contain an 'items' array");
  }

  let processedCount = 0;

  for (const item of data.items) {
    if (!item.name || !item.url) continue;

    const url = item.url.toLowerCase();
    const isImage = IMAGE_FORMATS.some(ext => url.includes(ext));
    const isVideo = VIDEO_FORMATS.some(ext => url.includes(ext));

    if (!isImage && !isVideo) continue;

    const contentItem: ContentItem = {
      id: randomUUID(),
      name: item.name,
      type: isImage ? "image" : "video",
      data: item.url, // For JSON, we store the URL as data
      mimeType: isImage ? "image/jpeg" : "video/mp4", // Default MIME types
      size: 0, // Unknown size for external URLs
      uploadedAt: new Date(),
    };

    session.contentLibrary.set(contentItem.id, contentItem);
    processedCount++;
  }

  // Broadcast updated content list
  const sessionState: SessionStatePayload = {
    id: session.id,
    hasContent: session.contentLibrary.size > 0,
    currentlyDisplayed: session.currentlyDisplayed,
    connectedDevices: session.subscribers.size,
  };

  broadcast(session, { type: "content-list", payload: Array.from(session.contentLibrary.values()) });
  broadcast(session, { type: "session-state", payload: sessionState });

  // Return a dummy content item representing the batch upload
  return {
    id: "json-upload",
    name: `${processedCount} items loaded from JSON`,
    type: "image",
    data: "",
    mimeType: "application/json",
    size: file.size,
    uploadedAt: new Date(),
  };
}

// Session cleanup management
function scheduleCleanup(sessionId: string): void {
  cancelCleanup(sessionId); // Cancel any existing timer

  const timer = setTimeout(() => {
    sessions.delete(sessionId);
    cleanupTimers.delete(sessionId);
  }, 5 * 60 * 1000); // 5 minutes

  cleanupTimers.set(sessionId, timer);
}

function cancelCleanup(sessionId: string): void {
  const timer = cleanupTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    cleanupTimers.delete(sessionId);
  }
}

// Utility functions
function isValidContentFormat(ext: string): boolean {
  return [...IMAGE_FORMATS, ...VIDEO_FORMATS].includes(ext);
}

function getExtension(fileName: string): string {
  return fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
}

function getNameWithoutExtension(fileName: string): string {
  return fileName.substring(0, fileName.lastIndexOf("."));
}

function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
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
  return mimeMap[ext] || "application/octet-stream";
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}