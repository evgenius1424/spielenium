import {randomUUID} from "crypto";
import {mkdir, readFile, writeFile} from "fs/promises";
import {join} from "path";
import {tmpdir} from "os";

export type ContentType = "image" | "video" | "none";

export type ContentItem = {
  id: string;
  name: string;
  type: ContentType;
  url: string;
  thumbnail?: string;
  size: number;
  uploadedAt: string;
  originalPath?: string;
};

export type DisplaySession = {
  id: string;
  createdAt: number;
  currentContent: ContentItem | null;
  contentLibrary: Map<string, ContentItem>;
  connectedDevices: Set<string>;
  subscribers: Set<(event: ServerEvent) => void>;
};

export type ServerEvent =
  | { type: "session-state"; payload: DisplaySessionPublic }
  | { type: "content-list"; payload: ContentItem[] }
  | {
      type: "content-selected";
      payload: {
        type: ContentType;
        url: string;
        name: string;
      };
    }
  | { type: "content-cleared"; payload: {} }
  | { type: "device-connected"; payload: { deviceId: string } }
  | { type: "device-disconnected"; payload: { deviceId: string } };

export type DisplaySessionPublic = {
  id: string;
  state: "waiting" | "showing-content" | "error";
  currentContent: ContentItem | null;
  connectedDevices: number;
  hasContent: boolean;
};

const sessions = new Map<string, DisplaySession>();
const SESSION_DIR = join(tmpdir(), "remote-display-sessions");

// Simple file-based session storage for persistence across API routes
async function saveSession(session: DisplaySession) {
  try {
    await mkdir(SESSION_DIR, { recursive: true });
    const sessionFile = join(SESSION_DIR, `${session.id}.json`);

    // Convert session to serializable format
    const sessionData = {
      id: session.id,
      createdAt: session.createdAt,
      currentContent: session.currentContent,
      contentLibrary: Array.from(session.contentLibrary.entries()),
      connectedDevices: Array.from(session.connectedDevices),
    };

    await writeFile(sessionFile, JSON.stringify(sessionData), "utf8");
  } catch (error) {
    console.error("Failed to save session:", error);
  }
}

async function loadSession(sessionId: string): Promise<DisplaySession | null> {
  try {
    const sessionFile = join(SESSION_DIR, `${sessionId}.json`);
    const data = await readFile(sessionFile, "utf8");
    const sessionData = JSON.parse(data);

    // Reconstruct session object
    const session: DisplaySession = {
      id: sessionData.id,
      createdAt: sessionData.createdAt,
      currentContent: sessionData.currentContent,
      contentLibrary: new Map(sessionData.contentLibrary),
      connectedDevices: new Set(sessionData.connectedDevices),
      subscribers: new Set(), // Subscribers are not persisted
    };

    return session;
  } catch (error) {
    // Session file doesn't exist or is invalid
    return null;
  }
}

async function loadAllSessions(): Promise<DisplaySession[]> {
  try {
    await mkdir(SESSION_DIR, { recursive: true });
    const fs = await import("fs/promises");
    const files = await fs.readdir(SESSION_DIR);
    const sessionFiles = files.filter((f) => f.endsWith(".json"));

    const sessionsPromises = sessionFiles.map(async (file) => {
      const sessionId = file.replace(".json", "");
      return loadSession(sessionId);
    });

    const loadedSessions = await Promise.all(sessionsPromises);
    return loadedSessions.filter((s): s is DisplaySession => s !== null);
  } catch (error) {
    return [];
  }
}

export async function createSession(
  customId?: string,
): Promise<DisplaySessionPublic> {
  const id = customId || randomUUID().slice(0, 6).toUpperCase();

  // Check if session exists in memory first
  if (sessions.has(id)) {
    return sessionToPublic(sessions.get(id)!);
  }

  // Check if session exists on disk
  const existingSession = await loadSession(id);
  if (existingSession) {
    sessions.set(id, existingSession);
    return sessionToPublic(existingSession);
  }

  // Create new session
  const session: DisplaySession = {
    id,
    createdAt: Date.now(),
    currentContent: null,
    contentLibrary: new Map(),
    connectedDevices: new Set(),
    subscribers: new Set(),
  };

  sessions.set(id, session);
  await saveSession(session);
  return sessionToPublic(session);
}

export async function getSession(
  id: string,
): Promise<DisplaySession | undefined> {
  // Check memory first
  const memorySession = sessions.get(id);
  if (memorySession) {
    return memorySession;
  }

  // Check file storage
  const fileSession = await loadSession(id);
  if (fileSession) {
    sessions.set(id, fileSession);
    return fileSession;
  }

  return undefined;
}

export async function getAllSessions(): Promise<DisplaySession[]> {
  // Load all sessions from disk and merge with memory
  const fileSessions = await loadAllSessions();
  const allSessions = new Map<string, DisplaySession>();

  // Add file sessions
  fileSessions.forEach((session) => {
    allSessions.set(session.id, session);
  });

  // Add/overwrite with memory sessions (they might be more up-to-date)
  sessions.forEach((session, id) => {
    allSessions.set(id, session);
  });

  return Array.from(allSessions.values());
}

export function sessionToPublic(session: DisplaySession): DisplaySessionPublic {
  return {
    id: session.id,
    state: session.currentContent ? "showing-content" : "waiting",
    currentContent: session.currentContent,
    connectedDevices: session.connectedDevices.size,
    hasContent: session.contentLibrary.size > 0,
  };
}

export function subscribe(
  session: DisplaySession,
  deviceId: string,
  cb: (e: ServerEvent) => void,
) {
  session.subscribers.add(cb);
  session.connectedDevices.add(deviceId);

  // Send initial state
  cb({ type: "session-state", payload: sessionToPublic(session) });
  cb({
    type: "content-list",
    payload: Array.from(session.contentLibrary.values()),
  });

  // Broadcast device connection
  broadcast(session, { type: "device-connected", payload: { deviceId } });

  return () => {
    session.subscribers.delete(cb);
    session.connectedDevices.delete(deviceId);
    broadcast(session, { type: "device-disconnected", payload: { deviceId } });
  };
}

function broadcast(session: DisplaySession, e: ServerEvent) {
  for (const cb of session.subscribers) {
    try {
      cb(e);
    } catch {
      /* ignore */
    }
  }
}

export async function selectContent(
  session: DisplaySession,
  contentId: string,
): Promise<boolean> {
  const content = session.contentLibrary.get(contentId);
  if (!content) return false;

  session.currentContent = content;
  await saveSession(session);

  broadcast(session, {
    type: "content-selected",
    payload: {
      type: content.type,
      url: content.url,
      name: content.name,
    },
  });

  broadcast(session, {
    type: "session-state",
    payload: sessionToPublic(session),
  });

  return true;
}

export async function clearContent(session: DisplaySession) {
  session.currentContent = null;

  await saveSession(session);

  broadcast(session, { type: "content-cleared", payload: {} });
  broadcast(session, {
    type: "session-state",
    payload: sessionToPublic(session),
  });
}

export async function addContent(
  session: DisplaySession,
  content: Omit<ContentItem, "id" | "uploadedAt">,
): Promise<ContentItem> {
  const item: ContentItem = {
    ...content,
    id: randomUUID(),
    uploadedAt: new Date().toISOString(),
  };

  session.contentLibrary.set(item.id, item);
  await saveSession(session);

  broadcast(session, {
    type: "content-list",
    payload: Array.from(session.contentLibrary.values()),
  });
  broadcast(session, {
    type: "session-state",
    payload: sessionToPublic(session),
  });

  return item;
}

export async function clearAllContent(session: DisplaySession) {
  session.contentLibrary.clear();
  session.currentContent = null;

  await saveSession(session);

  broadcast(session, { type: "content-list", payload: [] });
  broadcast(session, { type: "content-cleared", payload: {} });
  broadcast(session, {
    type: "session-state",
    payload: sessionToPublic(session),
  });
}
