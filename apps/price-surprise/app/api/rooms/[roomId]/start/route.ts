import { NextRequest, NextResponse } from "next/server";
import { getRoom, startGame } from "@/lib/rooms";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  try {
    const room = startGame(roomId);
    return NextResponse.json({ ok: true, room });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
