"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Badge } from "@repo/ui/components/badge";

type GameState = "category-selection" | "guessing" | "results" | "game-over";

type Item = { name: string; price: number; image: string; imageAnswer: string };

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

  const [player, setPlayer] = useState<Player | null>(() => {
    try {
      const storedPlayer = localStorage.getItem(`player_${roomId}`);
      return storedPlayer ? JSON.parse(storedPlayer) : null;
    } catch {
      return null;
    }
  });

  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [name, setName] = useState(player?.name || "");
  const [guess, setGuess] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (player) {
      const es = new EventSource(`/api/rooms/${roomId}/events`);

      es.addEventListener("state", (e: MessageEvent) => {
        const payload: RoomPublic = JSON.parse(e.data);
        setRoom(payload);
        if (payload.state !== "guessing") {
          setGuess("");
          setFeedback(null);
        }
      });

      es.addEventListener("question", () => {
        setGuess("");
        setFeedback(null);
      });

      return () => es.close();
    }
  }, [roomId, player]);

  async function doJoin() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok) {
        setPlayer(data);
        localStorage.setItem(`player_${roomId}`, JSON.stringify(data));
      }
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!player || !guess.trim()) return;
    setLoading(true);
    setFeedback("Sending your guess...");
    try {
      const num = Number.parseFloat(guess);
      if (Number.isNaN(num)) {
        setFeedback("Please enter a valid number.");
        return;
      }
      const res = await fetch(`/api/rooms/${roomId}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id, guess: num }),
      });
      if (res.ok) {
        setFeedback("Guess sent! Waiting for other players.");
      } else {
        setFeedback("Failed to send guess. Please try again.");
      }
    } catch {
      setFeedback("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      {!player ? (
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
              disabled={loading}
            />
            <Button onClick={doJoin} disabled={loading || !name.trim()}>
              {loading ? "Joining..." : "Join"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">
              Hello {player.name}
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
                  <Badge variant="secondary" className="mb-2">
                    {room.selectedCategory}
                  </Badge>
                </div>
                {room.currentItem.image && (
                  <div className="mx-auto w-full max-w-sm aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={room.currentItem.image}
                      alt={room.currentItem.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                <div className="text-center">
                  Price of{" "}
                  <span className="font-semibold">{room.currentItem.name}</span>
                  ?
                </div>
                <div className="flex gap-2">
                  <span className="self-center text-xl">€</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder="Enter your guess"
                    disabled={loading}
                  />
                  <Button onClick={submit} disabled={loading || !guess.trim()}>
                    {loading ? "Sending..." : "Send"}
                  </Button>
                </div>
                {feedback && (
                  <div className="text-center text-sm text-muted-foreground">
                    {feedback}
                  </div>
                )}
              </div>
            ) : room.state === "results" ? (
              <div className="space-y-3">
                <div className="text-center">
                  <Badge variant="secondary" className="mb-2">
                    {room.selectedCategory}
                  </Badge>
                </div>
                {room.currentItem && (
                  <div className="mx-auto w-full max-w-sm aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={room.currentItem.imageAnswer}
                      alt={room.currentItem.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="text-center">Check big screen for results…</div>
                </div>
              </div>
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
