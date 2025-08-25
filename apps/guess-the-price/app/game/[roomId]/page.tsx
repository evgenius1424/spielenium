// app/game/[roomId]/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Trophy } from "lucide-react";

type GameState = "category-selection" | "guessing" | "results" | "game-over";

type Item = { name: string; price: number; image?: string };

type Player = { id: string; name: string; score: number };

type RoomPublic = {
  id: string;
  state: GameState;
  selectedCategory: string | null;
  currentItem: Item | null;
  players: Player[];
  availableCategories: string[];
};

type GameData = { categories: Record<string, Item[]> };

export default function HostRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [diffs, setDiffs] = useState<
    Array<{ playerId: string; name: string; diff: number; guess?: number }>
  >([]);
  const [winner, setWinner] = useState<Player | null>(null);

  const [gameData, setGameData] = useState<GameData | null>(null);
  const [usedItems, setUsedItems] = useState<Set<string>>(new Set());

  // Load client-only game data
  useEffect(() => {
    try {
      const raw = localStorage.getItem("gameData");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.categories) {
          setGameData(parsed as GameData);
        }
      }
    } catch {}
  }, []);

  const availableCategories = useMemo(() => {
    if (!gameData) return [] as string[];
    const cats = Object.keys(gameData.categories || {});
    return cats.filter((cat) =>
      (gameData.categories[cat] || []).some((i) => !usedItems.has(i.name)),
    );
  }, [gameData, usedItems]);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource(`/api/rooms/${roomId}/events`);

    es.addEventListener("state", (e: MessageEvent) => {
      const payload: RoomPublic = JSON.parse(e.data);
      setRoom(payload);
      if (payload.state !== "results") {
        setDiffs([]);
        setWinner(null);
      }
    });

    es.addEventListener("result", (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as {
        item: Item;
        winner: Player | null;
        diffs: Array<{
          playerId: string;
          name: string;
          diff: number;
          guess?: number;
        }>;
      };
      setDiffs(payload.diffs);
      setWinner(payload.winner);
    });

    return () => es.close();
  }, [roomId]);

  async function pick(category: string) {
    if (!gameData) return;
    const pool = (gameData.categories[category] || []).filter(
      (i) => !usedItems.has(i.name),
    );
    if (pool.length === 0) return;
    const item = pool[Math.floor(Math.random() * pool.length)];
    const res = await fetch(`/api/rooms/${roomId}/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pick", category, item }),
    });
    if (res.ok) {
      // Optimistically mark as used locally to avoid duplicates
      setUsedItems((prev) => new Set(prev).add(item.name));
    }
  }

  async function closeRound() {
    await fetch(`/api/rooms/${roomId}/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
  }

  async function nextStep() {
    await fetch(`/api/rooms/${roomId}/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "next" }),
    });
  }

  if (!room) return <div className="p-6 text-center">Loading room…</div>;

  return (
    <div className="min-h-screen p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Room {room.id}</h1>
        <Badge variant="secondary">State: {room.state}</Badge>
      </div>

      {/* Scoreboard */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Players</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {room.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border p-3"
              >
                <span className="font-semibold truncate">{p.name}</span>
                <span className="text-xl font-bold">{p.score}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {room.state === "category-selection" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Choose a Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => pick(cat)}
                  className="h-16 rounded-xl border hover:bg-accent transition font-medium"
                >
                  {cat}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {room.state === "guessing" && room.currentItem && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              <Badge variant="secondary" className="mb-2">
                {room.selectedCategory}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {room.currentItem.image && (
              <div className="mx-auto w-full max-w-md aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={room.currentItem.image}
                  alt={room.currentItem.name}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            <div className="text-center text-2xl mt-4">
              What is the price of{" "}
              <span className="text-primary font-bold">
                {room.currentItem.name}
              </span>
              ?
            </div>
            <p className="text-center text-muted-foreground mt-2">
              Players: enter your guesses on your phones. When ready, close the
              round.
            </p>
            <div className="flex justify-center mt-4">
              <Button onClick={closeRound} className="h-12 px-8 text-lg">
                Close Round
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {room.state === "results" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              Round Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {winner && (
              <div className="flex items-center justify-center gap-3 mb-4 text-primary">
                <Trophy className="w-6 h-6" />
                <div className="text-xl font-bold">
                  {winner.name} wins this round!
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {diffs.map((d) => (
                <div
                  key={d.playerId}
                  className="rounded-xl border p-3 text-center"
                >
                  <div className="font-semibold">{d.name}</div>
                  {Number.isFinite(d.diff) ? (
                    <>
                      <div className="text-sm text-muted-foreground">Guess</div>
                      <div className="text-xl font-bold">${d.guess}</div>
                      <div className="text-sm">Diff: ${Math.round(d.diff)}</div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">No guess</div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-6">
              <Button onClick={nextStep} className="h-12 px-8 text-lg">
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {room.state === "game-over" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-3xl">Game Over</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {room.players
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <div key={p.id} className="rounded-xl border p-4 text-center">
                    <div className="text-2xl">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                    </div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xl font-bold">{p.score}</div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
