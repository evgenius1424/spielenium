export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getRoom, joinRoom } from "@/lib/rooms";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const room = getRoom(params.roomId);
  if (!room)
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const { name } = await req.json().catch(() => ({}));
  const player = joinRoom(room, String(name ?? ""));
  return NextResponse.json(player, { status: 201 });
}
