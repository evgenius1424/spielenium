import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/rooms";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { categories } = body;
    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: "Invalid categories" },
        { status: 400 },
      );
    }

    const room = createRoom(categories);
    return NextResponse.json({ id: room.id });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
