"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Badge } from "@repo/ui/components/badge";
import { motion, AnimatePresence } from "framer-motion";
import { RoomPublic, PlayerPublic, Category } from "@/lib/rooms";

// ─────────── Animations ───────────
const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
} as const;

const pop = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 },
  transition: { type: "spring", stiffness: 260, damping: 20 },
} as const;

const stagger = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { staggerChildren: 0.1 } },
  exit: { opacity: 0 },
};

// ─────────── Comparison Input ───────────
type ComparisonInputProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (finalValue?: number) => void;
  loading: boolean;
};

function ComparisonInput({ value, onChange, onSubmit, loading }: ComparisonInputProps) {
  const [side, setSide] = useState<"left" | "right">("right");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number.parseFloat(value);
    if (Number.isNaN(num)) return;
    onSubmit(side === "left" ? -num : num);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 items-center">
      <div className="flex gap-2 mb-2">
        <Button variant={side === "left" ? "default" : "outline"} onClick={() => setSide("left")} type="button">
          Left
        </Button>
        <Button variant={side === "right" ? "default" : "outline"} onClick={() => setSide("right")} type="button">
          Right
        </Button>
      </div>
      <div className="flex gap-2">
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} disabled={loading} />
        <Button type="submit" disabled={loading || !value.trim()}>
          {loading ? "Sending..." : "Send"}
        </Button>
      </div>
    </form>
  );
}

// ─────────── Main Component ───────────
export default function JoinRoom() {
  const params = useParams();
  const roomId = typeof params.roomId === "string" ? params.roomId : "";

  const [player, setPlayer] = useState<PlayerPublic | null>(null);
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [name, setName] = useState("");
  const [guess, setGuess] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Load player from localStorage
  useEffect(() => {
    if (!roomId) return;
    try {
      const stored = localStorage.getItem(`player_${roomId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as PlayerPublic;
        setPlayer(parsed);
        setName(parsed.name);
      }
    } catch { }
  }, [roomId]);

  // SSE subscription
  useEffect(() => {
    if (!player || !roomId) return;

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
  }, [roomId, player]);

  // Join room
  async function doJoin() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as PlayerPublic;
      setPlayer(data);
      localStorage.setItem(`player_${roomId}`, JSON.stringify(data));
    } finally {
      setLoading(false);
    }
  }

  // Submit guess
  async function submit(finalValue?: number) {
    if (!player) return;

    const num = finalValue ?? Number.parseFloat(guess);
    if (Number.isNaN(num)) {
      setFeedback("Please enter a valid number.");
      return;
    }

    setLoading(true);
    setFeedback("Sending your guess...");
    try {
      const res = await fetch(`/api/rooms/${roomId}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id, guess: num }),
      });
      setFeedback(res.ok ? "Guess sent! Waiting for other players." : "Failed to send guess.");
    } catch {
      setFeedback("An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen p-4 flex flex-col items-center justify-center">
      {/* Background Gradient */}
      <motion.div
        className="absolute inset-0 -z-10 w-full h-full bg-gradient-to-br from-purple-100 via-white to-pink-100"
        animate={{ rotate: [0, 1, 0], scale: [1, 1.02, 1] }}
        transition={{ duration: 15, repeat: Infinity, repeatType: "mirror" }}
      />

      <AnimatePresence mode="wait">
        {/* Join Room Form */}
        {!player && (
          <motion.div key="join" {...fade}>
            <Card className="w-full max-w-md mx-auto">
              <CardHeader>
                <CardTitle className="text-center text-2xl">Join Room {roomId}</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    doJoin();
                  }}
                  className="flex justify-center items-center gap-2 w-full"
                >
                  <Input
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    className="flex-1 max-w-xs"
                  />
                  <motion.div whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }}>
                    <Button type="submit" disabled={loading || !name.trim()}>
                      {loading ? "Joining..." : "Join"}
                    </Button>
                  </motion.div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Player Room */}
        {player && (
          <motion.div key="play" {...fade}>
            <Card className="w-full max-w-md mx-auto">
              <CardHeader>
                <CardTitle className="text-center text-xl">Hello {player.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {!room && <div className="text-center text-muted-foreground animate-pulse">Connecting…</div>}

                {/* Category Selection */}
                {/* Category Selection */}
                {room?.state === "category-selection" && room.currentPickerIndex != undefined && (
                  <div className="w-full px-4 sm:px-6">
                    {room.players[room.currentPickerIndex]?.id === player.id ? (
                      <motion.div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 justify-items-center">
                        {room.categories.map((category: Category) => (
                          <motion.button
                            key={category.name}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() =>
                              fetch(`/api/rooms/${room.id}/next`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "pick", playerId: player.id, category }),
                              })
                            }
                            className="flex flex-col items-center justify-between w-full max-w-[120px] min-h-[180px] rounded-xl border hover:bg-accent transition font-medium p-2 overflow-hidden"
                          >
                            {/* Icon: fixed height so it's always big */}
                            <img
                              src={category.logo}
                              alt={category.name}
                              className="h-2/3 w-2/3 object-contain mb-1"
                            />

                            {/* Name: allow wrap */}
                            <span className="text-sm font-medium text-center break-words mt-1">
                              {category.name}
                            </span>

                            {/* Items left: always at bottom */}
                            <span className="text-xs text-muted-foreground text-center break-words mt-auto">
                              {category.items.length} item{category.items.length !== 1 ? "s" : ""}
                            </span>
                          </motion.button>
                        ))}
                      </motion.div>
                    ) : (
                      <div className="text-muted-foreground text-center mt-4">
                        Waiting for {room.players[room.currentPickerIndex]?.name} to pick…
                      </div>
                    )}
                  </div>
                )}

                {/* Guessing */}
                {room?.state === "guessing" && room.currentItem && (
                  <motion.div {...pop} className="space-y-3 mt-4">
                    <div className="text-center">
                      <Badge variant="secondary">{room.selectedCategory?.name}</Badge>
                    </div>
                    {room.currentItem.image && (
                      <div className="mx-auto w-full max-w-sm aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                        <img src={room.currentItem.image} alt={room.currentItem.name} className="h-full w-full object-contain" />
                      </div>
                    )}
                    <div className="text-center">
                      {room.selectedCategory?.type === "comparison"
                        ? "Which side is more expensive and in how many %?"
                        : `Price of ${room.currentItem.name}?`}
                    </div>

                    {room.selectedCategory?.type === "comparison" ? (
                      <ComparisonInput value={guess} onChange={setGuess} onSubmit={submit} loading={loading} />
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          submit();
                        }}
                        className="flex justify-center gap-2 mt-2"
                      >
                        <span className="self-center text-xl">{room.selectedCategory?.type === "ruble" ? "₽" : "€"}</span>
                        <Input type="number" value={guess} onChange={(e) => setGuess(e.target.value)} disabled={loading} />
                        <Button type="submit" disabled={loading || !guess.trim()}>
                          {loading ? "Sending..." : "Send"}
                        </Button>
                      </form>
                    )}

                    {feedback && <motion.div {...fade} className="text-center text-sm mt-2">{feedback}</motion.div>}
                  </motion.div>
                )}

                {/* Results */}
                {room?.state === "results" && (
                  <motion.div {...pop} className="text-center text-muted-foreground mt-4">
                    Check big screen for results…
                  </motion.div>
                )}

                {/* Game Over */}
                {room?.state === "game-over" && (
                  <motion.div {...pop} className="text-center text-2xl font-semibold mt-4">
                    🎉 Game over. Thanks for playing!
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
