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
import { Badge } from "@repo/ui/components/badge";
import { Reorder, motion, AnimatePresence } from "framer-motion";
import { RoomPublic, Item, Category } from "@/lib/rooms";

// ─────────────────────────────────────────────────────────────
// Animation presets
// ─────────────────────────────────────────────────────────────

const pageFade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as any },
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const pop = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 },
};

export default function HostRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [diffs, setDiffs] = useState<
    Array<{ playerId: string; name: string; diff: number; guess?: number }>
  >([]);
  const [winners, setWinners] = useState<string[]>([]);
  const [losers, setLosers] = useState<string[]>([]);

  /* ─────────────────────────────────────────────────────────────
     SSE subscription
     ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    const es = new EventSource(`/api/rooms/${roomId}/events`);

    es.addEventListener("state", (e: MessageEvent) => {
      const payload: RoomPublic = JSON.parse(e.data);
      setRoom(payload);
      if (payload.state !== "results") {
        setDiffs([]);
        setWinners([]);
        setLosers([]);
      }
    });

    es.addEventListener("result", (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as {
        item: Item;
        winners: string[];
        losers: string[];
        diffs: typeof diffs;
      };
      setDiffs(payload.diffs);
      setWinners(payload.winners);
      setLosers(payload.losers);
    });

    return () => es.close();
  }, [roomId]);

  /* ─────────────────────────────────────────────────────────────
     Actions
     ───────────────────────────────────────────────────────────── */

  async function pick(category: Category) {
    const res = await fetch(`/api/rooms/${roomId}/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "pick",
        category,
      }),
    });
    if (!res.ok) console.error("Pick failed");
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
      body: JSON.stringify({
        action: room?.categories.length ? "next" : "game-over",
      }),
    });
  }

  if (!room) return <div className="p-6 text-center">Loading room…</div>;

  const sorted = [...room.players].sort((a, b) => b.score - a.score);

  const ranks: number[] = [];
  let lastScore: number | null = null;
  let lastRank = 0;

  sorted.forEach((p, i) => {
    if (p.score === lastScore) {
      ranks[i] = lastRank;
    } else {
      lastRank = i + 1;
      ranks[i] = lastRank;
      lastScore = p.score;
    }
  });

  return (
    <motion.div {...pageFade} className="min-h-screen p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.img
            src="/logo.png"
            alt="Price Surprise"
            className="h-12 sm:h-14 w-auto"
            initial={{ rotate: -5, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          />
          <h1 className="text-3xl font-bold">Room {room.id}</h1>
        </div>
        <Badge variant="secondary">State: {room.state}</Badge>
      </div>

      {/* Scoreboard */}
      <Card className="mb-6 overflow-hidden">
        <CardHeader>
          <CardTitle>Players</CardTitle>
        </CardHeader>
        <CardContent>
          <Reorder.Group
            axis="y"
            values={sorted}
            onReorder={() => { }}
            className="divide-y"
          >
            {sorted.map((p, i) => {
              const rank = ranks[i];
              const isTied =
                (i > 0 && p.score === sorted[i - 1]!.score) ||
                (i + 1 < sorted.length && p.score === sorted[i + 1]!.score);
              const displayRank = isTied ? `T${rank}` : `${rank}`;

              const displayMedal =
                ranks[i] === 1
                  ? "🥇"
                  : ranks[i] === 2
                    ? "🥈"
                    : ranks[i] === 3
                      ? "🥉"
                      : "";

              const playerStyle = winners.includes(p.id)
                ? "bg-yellow-100 border-l-4 border-yellow-400"
                : losers.includes(p.id)
                  ? "bg-red-100 border-l-4 border-red-400"
                  : p.voted
                    ? "bg-green-50 border-l-4 border-green-400"
                    : "bg-white border-l-4 border-transparent";

              return (
                <Reorder.Item
                  key={p.id}
                  value={p}
                  {...pop}
                  className={`grid grid-cols-[50px_1fr_auto] items-center px-4 py-3 rounded-lg ${playerStyle}`}
                >
                  <span className="font-semibold text-right pr-3">{displayRank}</span>
                  <span className="font-semibold truncate">{p.name}</span>
                  <div className="flex items-center gap-2 justify-end">
                    {room.state === "game-over" && displayMedal}
                    {winners.includes(p.id) && <span>🏆</span>}
                    {losers.includes(p.id) && <span>💀</span>}
                    {p.voted && !winners.includes(p.id) && !losers.includes(p.id) && (
                      <span>✅</span>
                    )}
                    <motion.span
                      key={p.score}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      className="text-xl font-bold"
                    >
                      {p.score}
                    </motion.span>
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </CardContent>
      </Card>

      {/* Game phases */}
      <AnimatePresence mode="wait">
        {room.state === "category-selection" && (
          <motion.div key="category" {...pageFade}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-2xl text-center">
                  Choose a Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <motion.div
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-2 md:grid-cols-4 gap-3"
                >
                  {room.categories.map((category) => {
                    const totalItems = category.items.length ?? 0;

                    return (
                      <motion.button
                        key={category.name}
                        variants={pop}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => pick(category)}
                        className="flex flex-col items-center rounded-xl border hover:bg-accent transition font-medium p-2"
                      >
                        <div className="w-full flex-1 flex items-center justify-center overflow-hidden rounded-xl mb-2">
                          <img
                            src={category.logo}
                            alt={category.name}
                            className="object-contain h-full w-full"
                          />
                        </div>
                        <span className="text-sm font-medium">{category.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {totalItems} item{totalItems !== 1 ? "s" : ""} left
                        </span>
                      </motion.button>
                    );
                  })}
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {room.state === "guessing" && room.currentItem && (
          <motion.div key="guessing" {...pageFade}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-center text-2xl">
                  <Badge variant="secondary" className="mb-2">
                    {room.selectedCategory?.name}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mx-auto w-full max-w-md aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
                >
                  <img
                    src={room.currentItem.image}
                    alt={room.currentItem.name}
                    className="h-full w-full object-contain"
                  />
                </motion.div>
                <div className="text-center text-2xl mt-4">
                  What is the price of{" "}
                  <span className="text-primary font-bold">
                    {room.currentItem.name}
                  </span>
                  ?
                </div>
                <p className="text-center text-muted-foreground mt-2">
                  Players: enter your guesses on your phones.
                </p>
                <div className="flex justify-center mt-4">
                  <Button onClick={closeRound} className="h-12 px-8 text-lg">
                    Close Round
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {room.state === "results" && room.currentItem && (
          <motion.div key="results" {...pageFade}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-center text-2xl">
                  Round Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <motion.div
                  initial={{ rotateX: 90 }}
                  animate={{ rotateX: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mx-auto w-full max-w-md aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
                >
                  <img
                    src={room.currentItem.imageAnswer}
                    alt={room.currentItem.name}
                    className="h-full w-full object-contain"
                  />
                </motion.div>
                <div className="text-center text-2xl mt-4">
                  The price of{" "}
                  <span className="text-primary font-bold">
                    {room.currentItem.name}
                  </span>
                  {" is "}
                  <span className="text-primary font-bold">
                    {room.currentItem.price}
                  </span>
                  !
                </div>
                <motion.div
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4"
                >
                  {diffs.map((d) => (
                    <motion.div
                      key={d.playerId}
                      variants={pop}
                      className="rounded-xl border p-3 text-center"
                    >
                      <div className="font-semibold">{d.name}</div>
                      {Number.isFinite(d.diff) ? (
                        <>
                          <div className="text-sm text-muted-foreground">Guess</div>
                          <div className="text-xl font-bold">€{d.guess}</div>
                          <div className="text-sm">Diff: €{Math.round(d.diff)}</div>
                        </>
                      ) : (
                        <div className="text-muted-foreground">No guess</div>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
                <div className="flex justify-center mt-6">
                  <Button onClick={nextStep} className="h-12 px-8 text-lg">
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {room.state === "game-over" && (
          <motion.div key="game-over" {...pageFade}>
            <Card>
              <CardHeader>
                <CardTitle className="text-center text-3xl">🎉 Game Over 🎉</CardTitle>
              </CardHeader>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
