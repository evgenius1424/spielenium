import { NextRequest, NextResponse } from "next/server";
import { closeRound, endGame, getRoom, nextStep, pickItem } from "@/lib/rooms";

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
    const category = String(body.category || "");
    // Allow client to provide the specific item to keep full dataset client-only
    const item = body?.item as { name: string; price: number } | undefined;
    const picked = pickItem(room, category, item as any);

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
