import { NextRequest, NextResponse } from "next/server";
import { endGame, closeRound, getRoom, nextStep, pickItem } from "@/lib/rooms";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = getRoom(roomId);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}) as any);
  const action = body?.action as "pick" | "close" | "next" | "game-over";

  // ───────────── PICK CATEGORY ─────────────
  if (action === "pick") {
    if (room.state !== "category-selection") {
      return NextResponse.json(
        { error: "Not the category-selection phase" },
        { status: 400 },
      );
    }

    const pickerIndex = room.currentCategoryPickerIndex ?? 0;
    const picker = [...room.players.values()][pickerIndex]!;

    if (body.playerId !== picker.id) {
      return NextResponse.json(
        { error: "Not your turn to pick a category" },
        { status: 403 },
      );
    }

    const picked = pickItem(room, body.category, body.item);
    if (!picked) {
      return NextResponse.json(
        { error: "No items left in category or item already used" },
        { status: 400 },
      );
    }

    // advance the round-robin picker
    room.currentCategoryPickerIndex = (pickerIndex + 1) % room.players.size;

    return NextResponse.json({ ok: true, picked });
  }

  // ───────────── CLOSE ROUND ─────────────
  if (action === "close") {
    if (room.state !== "guessing") {
      return NextResponse.json(
        { error: "Not the guessing phase" },
        { status: 400 },
      );
    }
    closeRound(room);
    return NextResponse.json({ ok: true });
  }

  // ───────────── GAME OVER ─────────────
  if (action === "game-over") {
    endGame(room);
    return NextResponse.json({ ok: true });
  }

  // ───────────── NEXT STEP ─────────────
  // Moves room to next logical state:
  // - lobby → category-selection
  // - category-selection → guessing
  // - guessing → results
  // - results → category-selection or game-over
  console.log("Room state before nextStep:", JSON.stringify(room, null, 2));
  nextStep(room);
  console.log("Room state after nextStep:", JSON.stringify(room, null, 2));
  return NextResponse.json({ ok: true });
}
