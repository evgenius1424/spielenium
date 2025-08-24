import { NextRequest } from "next/server";
import { getRoom, type ServerEvent, subscribe } from "@/lib/rooms";

function toSSE(e: ServerEvent) {
  return `event: ${e.type}\ndata: ${JSON.stringify(e.payload)}\n\n`;
}

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = getRoom(roomId);
  if (!room) {
    return new Response("Room not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: ServerEvent) =>
        controller.enqueue(new TextEncoder().encode(toSSE(e)));
      const unsubscribe = subscribe(room, send);

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

      // Close on client abort
      // @ts-ignore
      _req.signal?.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx
    },
  });
}
