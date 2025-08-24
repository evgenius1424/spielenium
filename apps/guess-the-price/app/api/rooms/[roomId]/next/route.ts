export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { closeRound, getRoom, nextStep, pickItem } from "@/lib/rooms";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const room = getRoom(params.roomId);
  if (!room)
    return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}) as any);
  const action = body?.action as "pick" | "close" | "next";

  if (action === "pick") {
    const category = String(body.category || "");
    const picked = pickItem(room, category);
    if (!picked)
      return NextResponse.json(
        { error: "No items left in category" },
        { status: 400 },
      );
    return NextResponse.json({ ok: true, picked });
  }

  if (action === "close") {
    closeRound(room);
    return NextResponse.json({ ok: true });
  }

  // default: move to next state (category-selection or game-over)
  nextStep(room);
  return NextResponse.json({ ok: true });
}
