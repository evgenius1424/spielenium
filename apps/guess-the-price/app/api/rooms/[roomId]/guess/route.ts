export const runtime = "nodejs";
import {NextRequest, NextResponse} from "next/server";
import {getRoom, submitGuess} from "@/lib/rooms";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const room = getRoom(params.roomId);
  if (!room)
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const { playerId, guess } = await req.json();
  if (!playerId || typeof guess !== "number") {
    return NextResponse.json(
      { error: "playerId and numeric guess required" },
      { status: 400 },
    );
  }
  submitGuess(room, playerId, guess);
  return NextResponse.json({ ok: true });
}
