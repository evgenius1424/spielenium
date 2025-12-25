import { NextRequest, NextResponse } from "next/server";
import { endGame, closeRound, getRoom, nextStep, pickItem } from "@/lib/rooms";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  // Await the params object to access its properties.
  const { roomId } = await params;
  const room = getRoom(roomId);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}) as any);
  const action = body?.action as "pick" | "close" | "next" | "game-over";

  if (action === "pick") {
    const picked = pickItem(room, body.category, body.item);

    if (!picked) {
      return NextResponse.json(
        { error: "No items left in category or item already used" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, picked });
  }

  if (action === "close") {
    closeRound(room);
    return NextResponse.json({ ok: true });
  }

  if (action === "game-over") {
    endGame(room);
    return NextResponse.json({ ok: true });
  }

  // default: move to next state (category-selection or game-over)
  console.log("Room state before nextStep:", JSON.stringify(room, null, 2));
  nextStep(room);
  console.log("Room state after nextStep:", JSON.stringify(room, null, 2));
  return NextResponse.json({ ok: true });
}
