import { NextRequest, NextResponse } from "next/server";
import { getRoom, joinRoom } from "@/lib/rooms";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { name } = await req.json().catch(() => ({}));
  const player = joinRoom(room, String(name ?? ""));
  return NextResponse.json(player, { status: 201 });
}
