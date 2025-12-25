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
import { motion, AnimatePresence } from "framer-motion";
import { RoomPublic, PlayerPublic } from "@/lib/rooms";

// ─────────── Animations ───────────
const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: {
    duration: 0.35,
    ease: [0.16, 1, 0.3, 1],
  },
} as const;

const pop = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 },
  transition: {
    type: "spring",
    stiffness: 260,
    damping: 20,
  },
} as const;

export default function JoinRoom() {
  const params = useParams();
  const roomId = typeof params.roomId === "string" ? params.roomId : "";

  const [player, setPlayer] = useState<PlayerPublic | null>(null);
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [name, setName] = useState("");
  const [guess, setGuess] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Load player from localStorage (client-only)
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

  async function submit() {
    if (!player || !guess.trim()) return;

    const num = Number.parseFloat(guess);
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

      setFeedback(
        res.ok
          ? "Guess sent! Waiting for other players."
          : "Failed to send guess."
      );
    } catch {
      setFeedback("An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {!player ? (
          <motion.div key="join" {...fade}>
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
                <motion.div whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }}>
                  <Button onClick={doJoin} disabled={loading || !name.trim()}>
                    {loading ? "Joining..." : "Join"}
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="play" {...fade}>
            <Card>
              <CardHeader>
                <CardTitle className="text-center text-xl">
                  Hello {player.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!room ? (
                  <div className="text-center text-muted-foreground animate-pulse">
                    Connecting…
                  </div>
                ) : room.state === "category-selection" ? (
                  <motion.div {...pop} className="text-center text-muted-foreground">
                    Waiting for host to pick a category…
                  </motion.div>
                ) : room.state === "guessing" && room.currentItem ? (
                  <motion.div {...pop} className="space-y-3">
                    <div className="text-center">
                      <Badge variant="secondary">
                        {room.selectedCategory?.name}
                      </Badge>
                    </div>

                    {room.currentItem.image && (
                      <div className="mx-auto w-full max-w-sm aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                        <img
                          src={room.currentItem.image}
                          alt={room.currentItem.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}

                    <div className="text-center">
                      Price of{" "}
                      <span className="font-semibold">
                        {room.currentItem.name}
                      </span>
                      ?
                    </div>

                    <div className="flex gap-2">
                      <span className="self-center text-xl">€</span>
                      <Input
                        type="number"
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        disabled={loading}
                      />
                      <Button onClick={submit} disabled={loading || !guess.trim()}>
                        {loading ? "Sending..." : "Send"}
                      </Button>
                    </div>

                    {feedback && (
                      <motion.div {...fade} className="text-center text-sm">
                        {feedback}
                      </motion.div>
                    )}
                  </motion.div>
                ) : room.state === "results" ? (
                  <motion.div {...pop} className="text-center text-muted-foreground">
                    Check big screen for results…
                  </motion.div>
                ) : (
                  <motion.div {...pop} className="text-center text-2xl font-semibold">
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
