import { randomUUID } from "crypto";

export type ContentType = "image" | "video" | "none";

export type ContentItem = {
  id: string;
  name: string;
  type: ContentType;
  url: string;
  thumbnail?: string;
  size: number;
  uploadedAt: string;
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
      }
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

export function createSession(customId?: string): DisplaySessionPublic {
  const id = customId || randomUUID().slice(0, 6).toUpperCase();

  // If session already exists, return it
  if (sessions.has(id)) {
    return sessionToPublic(sessions.get(id)!);
  }

  const session: DisplaySession = {
    id,
    createdAt: Date.now(),
    currentContent: null,
    contentLibrary: new Map(),
    connectedDevices: new Set(),
    subscribers: new Set(),
  };

  // Add some demo content
  addDemoContent(session);

  sessions.set(id, session);
  return sessionToPublic(session);
}

function addDemoContent(session: DisplaySession) {
  const demoContent: ContentItem[] = [
    {
      id: "demo-1",
      name: "Beautiful Sunset.jpg",
      type: "image",
      url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
      thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=150&fit=crop",
      size: 2048000,
      uploadedAt: new Date().toISOString(),
    },
    {
      id: "demo-2",
      name: "Mountain Lake.jpg",
      type: "image",
      url: "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=800&h=600&fit=crop",
      thumbnail: "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=200&h=150&fit=crop",
      size: 1824000,
      uploadedAt: new Date().toISOString(),
    },
    {
      id: "demo-3",
      name: "City Skyline.jpg",
      type: "image",
      url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=600&fit=crop",
      thumbnail: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=200&h=150&fit=crop",
      size: 2156000,
      uploadedAt: new Date().toISOString(),
    }
  ];

  demoContent.forEach(item => {
    session.contentLibrary.set(item.id, item);
  });
}

export function getSession(id: string): DisplaySession | undefined {
  return sessions.get(id);
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

export function subscribe(session: DisplaySession, deviceId: string, cb: (e: ServerEvent) => void) {
  session.subscribers.add(cb);
  session.connectedDevices.add(deviceId);

  // Send initial state
  cb({ type: "session-state", payload: sessionToPublic(session) });
  cb({ type: "content-list", payload: Array.from(session.contentLibrary.values()) });

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

export function selectContent(session: DisplaySession, contentId: string): boolean {
  const content = session.contentLibrary.get(contentId);
  if (!content) return false;

  session.currentContent = content;

  broadcast(session, {
    type: "content-selected",
    payload: {
      type: content.type,
      url: content.url,
      name: content.name,
    },
  });

  broadcast(session, { type: "session-state", payload: sessionToPublic(session) });

  return true;
}

export function clearContent(session: DisplaySession) {
  session.currentContent = null;

  broadcast(session, { type: "content-cleared", payload: {} });
  broadcast(session, { type: "session-state", payload: sessionToPublic(session) });
}

export function addContent(session: DisplaySession, content: Omit<ContentItem, "id" | "uploadedAt">): ContentItem {
  const item: ContentItem = {
    ...content,
    id: randomUUID(),
    uploadedAt: new Date().toISOString(),
  };

  session.contentLibrary.set(item.id, item);

  broadcast(session, { type: "content-list", payload: Array.from(session.contentLibrary.values()) });
  broadcast(session, { type: "session-state", payload: sessionToPublic(session) });

  return item;
}