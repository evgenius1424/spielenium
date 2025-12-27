import { NextRequest } from "next/server";
import { getOrCreateSession, type SSEEvent, subscribe } from "@/lib/sessions";

function toSSE(e: SSEEvent) {
  return `event: ${e.type}\ndata: ${JSON.stringify(e.payload)}\n\n`;
}

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  // Auto-create session on connect
  const session = getOrCreateSession(sessionId);

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: SSEEvent) =>
        controller.enqueue(new TextEncoder().encode(toSSE(e)));

      const unsubscribe = subscribe(session, send);

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
