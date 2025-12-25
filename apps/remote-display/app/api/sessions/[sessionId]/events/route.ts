import { NextRequest } from "next/server";
import {
  createSession,
  getSession,
  type ServerEvent,
  subscribe,
} from "@/lib/sessions";
import { randomUUID } from "crypto";

function toSSE(e: ServerEvent) {
  return `event: ${e.type}\ndata: ${JSON.stringify(e.payload)}\n\n`;
}

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  // Create session if it doesn't exist
  let session = await getSession(sessionId);
  if (!session) {
    await createSession(sessionId);
    session = await getSession(sessionId);
    if (!session) {
      return new Response("Failed to create session", { status: 500 });
    }
  }

  // Generate a unique device ID for this connection
  const deviceId = randomUUID().slice(0, 8);

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: ServerEvent) =>
        controller.enqueue(new TextEncoder().encode(toSSE(e)));

      const unsubscribe = subscribe(session!, deviceId, send);

      // heartbeat to keep proxies alive
      const interval = setInterval(() => {
        controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
      }, 15000);

      // cleanup
      const close = () => {
        clearInterval(interval);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };

      req.signal?.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
