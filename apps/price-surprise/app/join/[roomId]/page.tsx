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
        setFeedback(res.ok ? "✓ Guess sent!" : "Failed to send.");
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="safe-area-inset-top" />

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
    <motion.div {...FADE} className="px-4 pt-8">
      <div className="text-center mb-8">
        <Badge className="mb-3 bg-white/10 text-white border-white/20">
          Room {roomId}
        </Badge>
        <h1 className="text-3xl font-bold text-white">Join Game</h1>
        <p className="text-slate-400 mt-2">Enter your name to play</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onJoin();
        }}
        className="space-y-4"
      >
        <Input
          placeholder="Your name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={loading}
          autoFocus
          className="h-14 text-lg bg-white/10 border-white/20 text-white placeholder:text-slate-500 rounded-2xl"
        />
        <Button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full h-14 text-lg font-semibold rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
        >
          {loading ? "Joining..." : "Join Game"}
        </Button>
      </form>
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
    <motion.div {...FADE} className="px-4 pt-6 pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">Playing as</p>
          <h2 className="text-xl font-bold text-white">{player.name}</h2>
        </div>
        {room && (
          <Badge
            variant="outline"
            className="bg-white/10 text-white border-white/20 capitalize"
          >
            {room.state.replace("-", " ")}
          </Badge>
        )}
      </div>

      {!room && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-12 text-center">
            <div className="animate-pulse text-slate-400">Connecting…</div>
          </CardContent>
        </Card>
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
    </motion.div>
  );
}

function LobbyState() {
  return (
    <motion.div {...POP}>
      <Card className="bg-white/5 border-white/10">
        <CardContent className="py-12 text-center">
          <div className="text-4xl mb-3">🎮</div>
          <p className="text-white font-medium">Waiting for host to start…</p>
          <p className="text-slate-500 text-sm mt-1">Get ready!</p>
        </CardContent>
      </Card>
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
      <motion.div {...POP}>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-3">🤔</div>
            <p className="text-white font-medium">
              {picker?.name} is choosing…
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div {...POP} className="space-y-4">
      <div className="text-center">
        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 border-0">
          Your Turn!
        </Badge>
        <p className="text-white mt-2 font-medium">Pick a category</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {room.categories.map((category) => (
          <motion.button
            key={category.name}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPick(category)}
            className="flex flex-col items-center p-4 rounded-2xl bg-white/5 border border-white/10 active:bg-white/10 transition-colors"
          >
            <img
              src={category.logo}
              alt={category.name}
              className="h-16 w-16 object-contain mb-2"
            />
            <span className="text-white font-medium text-sm text-center">
              {category.name}
            </span>
            <span className="text-slate-500 text-xs mt-1">
              {category.items.length} items
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
        <Badge className="bg-white/10 border-white/20 text-white mb-2">
          {room.selectedCategory?.name}
        </Badge>
      </div>

      {room.currentItem?.image && (
        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-white/5 border border-white/10">
          <img
            src={room.currentItem.image}
            alt={room.currentItem.name}
            className="h-full w-full object-contain"
          />
        </div>
      )}

      <div className="text-center">
        <h3 className="text-white font-bold text-xl">
          {room.currentItem?.name}
        </h3>
        <p className="text-slate-400 text-sm mt-1">
          {isComparison ? "Which side is more expensive?" : "Guess the price"}
        </p>
      </div>

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
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl text-white font-bold">{symbol}</span>
            <Input
              type="number"
              inputMode="decimal"
              value={guess}
              onChange={(e) => onGuessChange(e.target.value)}
              disabled={loading}
              placeholder="0"
              className="flex-1 h-14 text-2xl font-bold bg-white/10 border-white/20 text-white rounded-2xl text-center"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !guess.trim()}
            className="w-full h-14 text-lg font-semibold rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
          >
            {loading ? "Sending..." : "Submit Guess"}
          </Button>
        </form>
      )}

      <AnimatePresence>
        {feedback && (
          <motion.p {...FADE} className="text-center text-sm text-slate-300">
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
          className={`h-12 rounded-xl font-semibold ${
            side === "left"
              ? "bg-violet-500 hover:bg-violet-600"
              : "bg-white/5 border-white/20 text-white"
          }`}
        >
          ← Left
        </Button>
        <Button
          type="button"
          variant={side === "right" ? "default" : "outline"}
          onClick={() => setSide("right")}
          className={`h-12 rounded-xl font-semibold ${
            side === "right"
              ? "bg-violet-500 hover:bg-violet-600"
              : "bg-white/5 border-white/20 text-white"
          }`}
        >
          Right →
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-2xl text-white font-bold">%</span>
        <Input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          placeholder="0"
          className="flex-1 h-14 text-2xl font-bold bg-white/10 border-white/20 text-white rounded-2xl text-center"
        />
      </div>

      <Button
        type="submit"
        disabled={loading || !value.trim()}
        className="w-full h-14 text-lg font-semibold rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
      >
        {loading ? "Sending..." : "Submit Guess"}
      </Button>
    </form>
  );
}

function ResultsState() {
  return (
    <motion.div {...POP}>
      <Card className="bg-white/5 border-white/10">
        <CardContent className="py-12 text-center">
          <div className="text-4xl mb-3">📺</div>
          <p className="text-white font-medium">Check the big screen!</p>
          <p className="text-slate-500 text-sm mt-1">Results are showing…</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function GameOverState() {
  return (
    <motion.div {...POP}>
      <Card className="bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border-white/10">
        <CardContent className="py-12 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold text-white">Game Over!</h2>
          <p className="text-slate-300 mt-2">Thanks for playing!</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
