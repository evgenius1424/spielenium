"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Badge } from "@repo/ui/components/badge";
import { motion, AnimatePresence } from "framer-motion";
import type { RoomPublic, PlayerPublic, Category } from "@/lib/rooms";

const FADE = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
} as const;

const POP = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 },
  transition: { type: "spring", stiffness: 260, damping: 20 },
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

  useEffect(() => {
    if (!roomId) return;
    try {
      const stored = localStorage.getItem(`player_${roomId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as PlayerPublic;
        setPlayer(parsed);
        setName(parsed.name);
      }
    } catch {}
  }, [roomId]);

  useEffect(() => {
    if (!player || !roomId) return;

    const es = new EventSource(`/api/rooms/${roomId}/events`);

    const handleState = (e: MessageEvent) => {
      const payload: RoomPublic = JSON.parse(e.data);
      setRoom(payload);
      if (payload.state !== "guessing") {
        setGuess("");
        setFeedback(null);
      }
    };

    const handleQuestion = () => {
      setGuess("");
      setFeedback(null);
    };

    es.addEventListener("state", handleState);
    es.addEventListener("question", handleQuestion);

    return () => es.close();
  }, [roomId, player]);

  const doJoin = useCallback(async () => {
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
  }, [name, roomId]);

  const submitGuess = useCallback(
    async (finalValue?: number) => {
      if (!player) return;

      const num = finalValue ?? Number.parseFloat(guess);
      if (Number.isNaN(num)) {
        setFeedback("Please enter a valid number.");
        return;
      }

      setLoading(true);
      setFeedback("Sending...");
      try {
        const res = await fetch(`/api/rooms/${roomId}/guess`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: player.id, guess: num }),
        });
        setFeedback(
          res.ok ? "Guess sent! Waiting for others." : "Failed to send.",
        );
      } catch {
        setFeedback("An error occurred.");
      } finally {
        setLoading(false);
      }
    },
    [player, guess, roomId],
  );

  const pickCategory = useCallback(
    async (category: Category) => {
      if (!room || !player) return;
      await fetch(`/api/rooms/${room.id}/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pick", playerId: player.id, category }),
      });
    },
    [room, player],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-md mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {!player ? (
            <JoinForm
              key="join"
              roomId={roomId}
              name={name}
              loading={loading}
              onNameChange={setName}
              onJoin={doJoin}
            />
          ) : (
            <PlayerView
              key="play"
              player={player}
              room={room}
              guess={guess}
              loading={loading}
              feedback={feedback}
              onGuessChange={setGuess}
              onSubmitGuess={submitGuess}
              onPickCategory={pickCategory}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function JoinForm({
  roomId,
  name,
  loading,
  onNameChange,
  onJoin,
}: {
  roomId: string;
  name: string;
  loading: boolean;
  onNameChange: (v: string) => void;
  onJoin: () => void;
}) {
  return (
    <motion.div {...FADE}>
      <Card>
        <CardContent className="pt-6">
          <h1 className="text-2xl font-bold text-center mb-6">
            Join Room {roomId}
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onJoin();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              disabled={loading}
              autoFocus
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Joining..." : "Join"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PlayerView({
  player,
  room,
  guess,
  loading,
  feedback,
  onGuessChange,
  onSubmitGuess,
  onPickCategory,
}: {
  player: PlayerPublic;
  room: RoomPublic | null;
  guess: string;
  loading: boolean;
  feedback: string | null;
  onGuessChange: (v: string) => void;
  onSubmitGuess: (finalValue?: number) => void;
  onPickCategory: (category: Category) => void;
}) {
  return (
    <motion.div {...FADE}>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Hello, {player.name}</h2>
            {room && (
              <Badge variant="secondary" className="capitalize">
                {room.state.replace("-", " ")}
              </Badge>
            )}
          </div>

          {!room && (
            <p className="text-center text-muted-foreground animate-pulse py-8">
              Connecting…
            </p>
          )}

          {room?.state === "lobby" && <LobbyState />}

          {room?.state === "category-selection" && (
            <CategorySelectionState
              room={room}
              playerId={player.id}
              onPick={onPickCategory}
            />
          )}

          {room?.state === "guessing" && room.currentItem && (
            <GuessingState
              room={room}
              guess={guess}
              loading={loading}
              feedback={feedback}
              onGuessChange={onGuessChange}
              onSubmit={onSubmitGuess}
            />
          )}

          {room?.state === "results" && <ResultsState />}

          {room?.state === "game-over" && <GameOverState />}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LobbyState() {
  return (
    <motion.div {...POP} className="text-center py-8">
      <p className="text-muted-foreground">Waiting for host to start…</p>
    </motion.div>
  );
}

function CategorySelectionState({
  room,
  playerId,
  onPick,
}: {
  room: RoomPublic;
  playerId: string;
  onPick: (category: Category) => void;
}) {
  const picker = room.players[room.currentPickerIndex!];
  const isMyTurn = picker?.id === playerId;

  if (!isMyTurn) {
    return (
      <motion.div {...POP} className="text-center py-8">
        <p className="text-muted-foreground">
          Waiting for {picker?.name} to pick…
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div {...POP} className="space-y-4">
      <p className="text-center font-medium">Pick a category</p>
      <div className="grid grid-cols-2 gap-3">
        {room.categories.map((category) => (
          <motion.button
            key={category.name}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPick(category)}
            className="flex flex-col items-center p-3 rounded-xl border hover:bg-accent transition-colors"
          >
            <img
              src={category.logo}
              alt={category.name}
              className="h-12 w-12 object-contain mb-2"
            />
            <span className="font-medium text-sm text-center">
              {category.name}
            </span>
            <span className="text-muted-foreground text-xs mt-1">
              {category.items.length} item
              {category.items.length !== 1 ? "s" : ""}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

function GuessingState({
  room,
  guess,
  loading,
  feedback,
  onGuessChange,
  onSubmit,
}: {
  room: RoomPublic;
  guess: string;
  loading: boolean;
  feedback: string | null;
  onGuessChange: (v: string) => void;
  onSubmit: (finalValue?: number) => void;
}) {
  const isComparison = room.selectedCategory?.type === "comparison";
  const symbol =
    room.selectedCategory?.type === "ruble"
      ? "₽"
      : room.selectedCategory?.type === "comparison"
        ? "%"
        : "€";

  return (
    <motion.div {...POP} className="space-y-4">
      <div className="text-center">
        <Badge variant="secondary" className="mb-2">
          {room.selectedCategory?.name}
        </Badge>
      </div>

      {room.currentItem?.image && (
        <div className="aspect-[4/3] rounded-lg overflow-hidden border bg-muted">
          <img
            src={room.currentItem.image}
            alt={room.currentItem.name}
            className="h-full w-full object-contain"
          />
        </div>
      )}

      <p className="text-center">
        {isComparison
          ? "Which side is more expensive and by how much?"
          : `Price of ${room.currentItem?.name}?`}
      </p>

      {isComparison ? (
        <ComparisonInput
          value={guess}
          onChange={onGuessChange}
          onSubmit={onSubmit}
          loading={loading}
        />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex gap-2"
        >
          <span className="self-center text-xl">{symbol}</span>
          <Input
            type="number"
            inputMode="decimal"
            value={guess}
            onChange={(e) => onGuessChange(e.target.value)}
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !guess.trim()}>
            {loading ? "..." : "Send"}
          </Button>
        </form>
      )}

      <AnimatePresence>
        {feedback && (
          <motion.p
            {...FADE}
            className="text-center text-sm text-muted-foreground"
          >
            {feedback}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ComparisonInput({
  value,
  onChange,
  onSubmit,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (finalValue?: number) => void;
  loading: boolean;
}) {
  const [side, setSide] = useState<"left" | "right">("right");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number.parseFloat(value);
    if (Number.isNaN(num)) return;
    onSubmit(side === "left" ? -num : num);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={side === "left" ? "default" : "outline"}
          onClick={() => setSide("left")}
        >
          ← Left
        </Button>
        <Button
          type="button"
          variant={side === "right" ? "default" : "outline"}
          onClick={() => setSide("right")}
        >
          Right →
        </Button>
      </div>

      <div className="flex gap-2">
        <span className="self-center text-xl">%</span>
        <Input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !value.trim()}>
          {loading ? "..." : "Send"}
        </Button>
      </div>
    </form>
  );
}

function ResultsState() {
  return (
    <motion.div {...POP} className="text-center py-8">
      <p className="text-muted-foreground">Check the big screen for results…</p>
    </motion.div>
  );
}

function GameOverState() {
  return (
    <motion.div {...POP} className="text-center py-8">
      <p className="text-2xl font-semibold">🎉 Game Over!</p>
      <p className="text-muted-foreground mt-2">Thanks for playing!</p>
    </motion.div>
  );
}
