"use client";
import {useEffect, useState} from "react";
import {useParams} from "next/navigation";
import {Button} from "@repo/ui/components/button";
import {Card, CardContent, CardHeader, CardTitle,} from "@repo/ui/components/card";
import {Input} from "@repo/ui/components/input";
import {Badge} from "@repo/ui/components/badge";

type GameState = "category-selection" | "guessing" | "results" | "game-over";

type Item = { name: string; price: number };

type Player = { id: string; name: string; score: number };

type RoomPublic = {
  id: string;
  state: GameState;
  selectedCategory: string | null;
  currentItem: Item | null;
  players: Player[];
  availableCategories: string[];
};

export default function JoinRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);
  const [guess, setGuess] = useState("");

  useEffect(() => {
    const es = new EventSource(`/api/rooms/${roomId}/events`);

    es.addEventListener("state", (e: MessageEvent) => {
      const payload: RoomPublic = JSON.parse(e.data);
      setRoom(payload);
      // clear guess if state changed away from guessing
      if (payload.state !== "guessing") setGuess("");
    });

    es.addEventListener("question", () => {
      setGuess("");
    });

    return () => es.close();
  }, [roomId]);

  async function doJoin() {
    const res = await fetch(`/api/rooms/${roomId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (res.ok) {
      setPlayer(data);
      setJoined(true);
    }
  }

  async function submit() {
    if (!player) return;
    const num = Number.parseFloat(guess);
    if (Number.isNaN(num)) return;
    await fetch(`/api/rooms/${roomId}/guess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: player.id, guess: num }),
    });
  }

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      {!joined ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              Join Room {roomId}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={doJoin} disabled={!name.trim()}>
              Join
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">
              Hello {player?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!room ? (
              <div>Connecting…</div>
            ) : room.state === "category-selection" ? (
              <div className="text-center text-muted-foreground">
                Waiting for host to pick a category…
              </div>
            ) : room.state === "guessing" && room.currentItem ? (
              <div className="space-y-3">
                <div className="text-center">
                  <Badge variant="secondary" className="mb-1">
                    {room.selectedCategory}
                  </Badge>
                  <div>
                    Price of{" "}
                    <span className="font-semibold">
                      {room.currentItem.name}
                    </span>
                    ?
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="self-center text-xl">$</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder="Enter your guess"
                  />
                  <Button onClick={submit} disabled={guess.trim() === ""}>
                    Send
                  </Button>
                </div>
              </div>
            ) : room.state === "results" ? (
              <div className="text-center">Check big screen for results…</div>
            ) : room.state === "game-over" ? (
              <div className="text-center font-semibold">
                Game over. Thanks for playing!
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
