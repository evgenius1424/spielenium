"use client";

import {useEffect, useState, useCallback} from "react";
import {useParams} from "next/navigation";
import {Button} from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {Badge} from "@repo/ui/components/badge";
import {Reorder, motion, AnimatePresence} from "framer-motion";
import type {RoomPublic, Item} from "@/lib/rooms";

const PAGE_FADE = {
  initial: {opacity: 0, y: 12},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: -12},
  transition: {duration: 0.35, ease: [0.16, 1, 0.3, 1]},
} as const;

const STAGGER = {
  animate: {transition: {staggerChildren: 0.15}},
} as const;

const POP = {
  initial: {scale: 0.8, opacity: 0, y: 20},
  animate: {scale: 1, opacity: 1, y: 0},
  exit: {scale: 0.8, opacity: 0},
} as const;

const DART_COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"
];

type PlayerDiff = {
  playerId: string;
  name: string;
  diff: number;
  guess?: number;
};

export default function HostRoom() {
  const {roomId} = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [diffs, setDiffs] = useState<PlayerDiff[]>([]);
  const [winners, setWinners] = useState<string[]>([]);
  const [losers, setLosers] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const es = new EventSource(`/api/rooms/${roomId}/events`);

    const handleState = (e: MessageEvent) => {
      const payload: RoomPublic = JSON.parse(e.data);
      setRoom(payload);
      if (payload.state !== "results") {
        setDiffs([]);
        setWinners([]);
        setLosers([]);
      }
    };

    const handleResult = (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as {
        item: Item;
        winners: string[];
        losers: string[];
        diffs: PlayerDiff[];
      };
      setDiffs(payload.diffs);
      setWinners(payload.winners);
      setLosers(payload.losers);
    };

    es.addEventListener("state", handleState);
    es.addEventListener("result", handleResult);

    return () => es.close();
  }, [roomId]);

  const copyJoinLink = useCallback(() => {
    if (!room) return;
    const link = `${window.location.origin}/join/${room.id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [room]);

  const startGame = useCallback(async () => {
    if (!room) return;
    const res = await fetch(`/api/rooms/${room.id}/start`, {method: "POST"});
    if (!res.ok) console.error("Failed to start game");
  }, [room]);

  const closeRound = useCallback(async () => {
    await fetch(`/api/rooms/${roomId}/next`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({action: "close"}),
    });
  }, [roomId]);

  const nextStep = useCallback(async () => {
    await fetch(`/api/rooms/${roomId}/next`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        action: room?.categories.length ? "next" : "game-over",
      }),
    });
  }, [roomId, room?.categories.length]);

  if (!room) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading room…</p>
      </div>
    );
  }

  const rankedPlayers = computeRankedPlayers(room.players);

  return (
    <motion.div
      {...PAGE_FADE}
      className="h-screen flex flex-col overflow-hidden"
    >
      <Header room={room} copied={copied} onCopyLink={copyJoinLink}/>

      <div className="flex-1 flex min-h-0 relative">
        <main className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <AnimatePresence mode="wait">
            {room.state === "lobby" && (
              <LobbyPhase
                key="lobby"
                onStart={startGame}
                disabled={room.players.length === 0}
              />
            )}

            {room.state === "category-selection" && (
              <CategorySelectionPhase
                key="category"
                pickerName={room.players[room.currentPickerIndex!]?.name}
                categories={room.categories}
              />
            )}

            {room.state === "guessing" && room.currentItem && (
              <GuessingPhase
                key="guessing"
                item={room.currentItem}
                categoryName={room.selectedCategory?.name}
                onCloseRound={closeRound}
              />
            )}

            {room.state === "results" && room.currentItem && (
              <ResultsPhase
                key="results"
                item={room.currentItem}
                categoryType={room.selectedCategory?.type}
                diffs={diffs}
                winners={winners}
                losers={losers}
                onNext={nextStep}
              />
            )}

            {room.state === "game-over" && <GameOverPhase key="game-over"/>}
          </AnimatePresence>
        </main>

        <aside className="absolute top-4 right-4 w-72">
          <Scoreboard
            players={rankedPlayers}
            winners={winners}
            losers={losers}
            isGameOver={room.state === "game-over"}
          />
        </aside>
      </div>
    </motion.div>
  );
}

function Header({
                  room,
                  copied,
                  onCopyLink,
                }: {
  room: RoomPublic;
  copied: boolean;
  onCopyLink: () => void;
}) {
  return (
    <header className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <motion.img
          src="/logo.png"
          alt="Price Surprise"
          className="h-12 sm:h-14 w-auto"
          initial={{rotate: -5, opacity: 0}}
          animate={{rotate: 0, opacity: 1}}
          transition={{type: "spring", stiffness: 200}}
        />
        <h1
          className="text-3xl font-bold cursor-pointer select-all"
          onClick={onCopyLink}
          title="Click to copy join link"
        >
          Room {room.id}
        </h1>
        <AnimatePresence>
          {copied && (
            <motion.span
              initial={{opacity: 0, x: -10}}
              animate={{opacity: 1, x: 0}}
              exit={{opacity: 0}}
              className="text-sm text-green-600 font-medium"
            >
              Link copied!
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <Badge variant="secondary">State: {room.state}</Badge>
    </header>
  );
}

function Scoreboard({
                      players,
                      winners,
                      losers,
                      isGameOver,
                    }: {
  players: RankedPlayer[];
  winners: string[];
  losers: string[];
  isGameOver: boolean;
}) {
  return (
    <Card className="max-h-[calc(100vh-8rem)] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle>Players</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <Reorder.Group
          axis="y"
          values={players}
          onReorder={() => {
          }}
          className="space-y-2"
        >
          {players.map((p) => (
            <Reorder.Item
              key={p.id}
              value={p}
              {...POP}
              className={`grid grid-cols-[40px_1fr_auto] items-center px-3 py-2 rounded-lg ${getPlayerStyle(p.id, p.voted, winners, losers)}`}
            >
              <span className="font-semibold text-right pr-2">
                {p.isTied ? `T${p.rank}` : p.rank}
              </span>
              <span className="font-semibold truncate">{p.name}</span>
              <div className="flex items-center gap-1.5">
                {isGameOver && getMedal(p.rank)}
                {winners.includes(p.id) && <span>🏆</span>}
                {losers.includes(p.id) && <span>💀</span>}
                {p.voted &&
                  !winners.includes(p.id) &&
                  !losers.includes(p.id) && <span>✅</span>}
                <motion.span
                  key={p.score}
                  initial={{scale: 1.2}}
                  animate={{scale: 1}}
                  className="text-lg font-bold min-w-[2ch] text-right"
                >
                  {p.score}
                </motion.span>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </CardContent>
    </Card>
  );
}

function LobbyPhase({
                      onStart,
                      disabled,
                    }: {
  onStart: () => void;
  disabled: boolean;
}) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Lobby</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-center text-muted-foreground">
          Waiting for players to join…
        </p>
        <Button
          onClick={onStart}
          disabled={disabled}
          className="mx-auto h-12 text-lg"
        >
          Start Game
        </Button>
      </CardContent>
    </Card>
  );
}

function CategorySelectionPhase({
                                  pickerName,
                                  categories,
                                }: {
  pickerName?: string;
  categories: RoomPublic["categories"];
}) {
  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-2xl text-center">
          Category Selection
        </CardTitle>
        <p className="text-center text-lg text-muted-foreground">
          {pickerName} is choosing a category…
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((category) => (
            <div
              key={category.name}
              className="flex flex-col items-center rounded-xl border p-3 hover:bg-accent/50 transition-colors"
            >
              <div className="aspect-square w-full flex items-center justify-center overflow-hidden mb-2">
                {category.logo && (
                  <img
                    src={category.logo}
                    alt={category.name}
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <span className="text-sm font-medium text-center">
                {category.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {category.items.length} item
                {category.items.length !== 1 ? "s" : ""} left
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GuessingPhase({
                         item,
                         categoryName,
                         onCloseRound,
                       }: {
  item: Item;
  categoryName?: string;
  onCloseRound: () => void;
}) {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-center">
          <Badge variant="secondary" className="mb-2">
            {categoryName}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <motion.div
          initial={{scale: 0.95, opacity: 0}}
          animate={{scale: 1, opacity: 1}}
          className="mx-auto w-full max-w-md aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
        >
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full object-contain"
          />
        </motion.div>
        <p className="text-center text-2xl">
          What is the price of{" "}
          <span className="text-primary font-bold">{item.name}</span>?
        </p>
        <p className="text-center text-muted-foreground">
          Players: enter your guesses on your phones.
        </p>
        <div className="flex justify-center">
          <Button onClick={onCloseRound} className="h-12 px-8 text-lg">
            Close Round
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsPhase({
                        item,
                        categoryType,
                        diffs,
                        winners,
                        losers,
                        onNext,
                      }: {
  item: Item;
  categoryType?: string;
  diffs: PlayerDiff[];
  winners: string[];
  losers: string[];
  onNext: () => void;
}) {
  const symbol = categoryType === "ruble" ? "₽" : categoryType === "comparison" ? "%" : "€";
  const [revealedDarts, setRevealedDarts] = useState<string[]>([]);
  const sortedDiffs = [...diffs].sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));
  const maxDiff = Math.max(...diffs.filter(d => Number.isFinite(d.diff)).map(d => Math.abs(d.diff)), 1);

  useEffect(() => {
    setRevealedDarts([]);
    sortedDiffs.forEach((d, i) => {
      setTimeout(() => setRevealedDarts(prev => [...prev, d.playerId]), i * 300 + 500);
    });
  }, [diffs]);

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="text-center text-2xl">🎯 Round Results</CardTitle>
        <p className="text-center text-lg text-muted-foreground">
          <span className="font-bold text-foreground">{item.name}</span> costs{" "}
          <span className="font-bold text-primary">{symbol}{item.price}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <DartsBoard diffs={diffs} winners={winners} losers={losers} maxDiff={maxDiff} revealedDarts={revealedDarts}/>
        </div>

        <motion.div variants={STAGGER} initial="initial" animate="animate" className="space-y-2">
          {sortedDiffs.map((d, i) => {
            const isWinner = winners.includes(d.playerId);
            const isLoser = losers.includes(d.playerId);
            const color = DART_COLORS[diffs.findIndex(x => x.playerId === d.playerId) % DART_COLORS.length];
            const hasGuess = Number.isFinite(d.diff);

            return (
              <motion.div
                key={d.playerId}
                variants={POP}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isWinner ? "bg-yellow-500/10 border-yellow-500/50" :
                    isLoser ? "bg-red-500/10 border-red-500/50" :
                      "bg-muted/30 border-border"
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{backgroundColor: color}}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate flex items-center gap-2">
                    {d.name}
                    {isWinner && <span>🏆</span>}
                    {isLoser && <span className="text-sm">💀🔥</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {hasGuess ? `Guessed: ${symbol}${d.guess}` : "No guess"}
                  </p>
                </div>
                {hasGuess && (
                  <div
                    className={`text-right ${isWinner ? "text-green-500" : isLoser ? "text-red-500" : "text-foreground"}`}>
                    <p className="text-xl font-bold">{d.guess! > item.price ? "+" : "-"}{Math.round(d.diff)}</p>
                    <p className="text-xs text-muted-foreground">difference</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        <div className="flex justify-center">
          <Button onClick={onNext} className="h-12 px-8 text-lg">Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DartsBoard({
                      diffs,
                      winners,
                      losers,
                      maxDiff,
                      revealedDarts,
                    }: {
  diffs: PlayerDiff[];
  winners: string[];
  losers: string[];
  maxDiff: number;
  revealedDarts: string[];
}) {
  const size = 320;
  const center = size / 2;
  const boardRadius = 130;
  const ringRadii = [130, 105, 80, 55, 30, 12];
  const ringColors = ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#0f3460", "#e94560"];

  return (
    <motion.div
      initial={{scale: 0.9, opacity: 0}}
      animate={{scale: 1, opacity: 1}}
      transition={{duration: 0.4, type: "spring"}}
      className="relative overflow-visible"
      style={{width: size, height: size}}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full drop-shadow-xl">
        <defs>
          <radialGradient id="boardShine" cx="35%" cy="35%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0.1)"/>
          </radialGradient>
        </defs>

        <circle cx={center} cy={center} r={boardRadius + 10} fill="#2a2a3a" stroke="#444" strokeWidth="4"/>

        {ringRadii.map((r, i) => (
          <circle key={i} cx={center} cy={center} r={r} fill={ringColors[i]} stroke="#333" strokeWidth="1"/>
        ))}

        <circle cx={center} cy={center} r={ringRadii[ringRadii.length - 1]} fill="#ffd700"/>

        {[...Array(8)].map((_, i) => {
          const angle = (i * 45) * Math.PI / 180;
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={center + Math.cos(angle) * boardRadius}
              y2={center + Math.sin(angle) * boardRadius}
              stroke="#333"
              strokeWidth="1"
              opacity="0.5"
            />
          );
        })}

        <text x={center} y={18} textAnchor="middle" fill="#ffd700" fontSize="11" fontWeight="bold">BULLSEYE</text>
      </svg>

      <AnimatePresence>
        {diffs.map((d, i) => {
          if (!revealedDarts.includes(d.playerId)) return null;
          const isLoser = losers.includes(d.playerId) || !Number.isFinite(d.diff);
          const isWinner = winners.includes(d.playerId);
          const color = DART_COLORS[i % DART_COLORS.length];
          const pos = isLoser
            ? getMissPosition(i, center, boardRadius)
            : getDartPosition(d.diff, maxDiff, i, center, boardRadius);

          return (
            <motion.div
              key={d.playerId}
              initial={{left: center + 100, top: -50, scale: 0.5, opacity: 0}}
              animate={{left: pos.x - 12, top: pos.y - 12, scale: 1, opacity: 1}}
              transition={{type: "spring", stiffness: 300, damping: 20}}
              className="absolute"
              style={{zIndex: isWinner ? 20 : 10}}
            >
              <DartPin color={color} isWinner={isWinner} isLoser={isLoser} name={d.name}/>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

function DartPin({color, isWinner, isLoser, name}: {
  color: string;
  isWinner: boolean;
  isLoser: boolean;
  name: string
}) {
  return (
    <div className="relative">
      <motion.div animate={isWinner ? {scale: [1, 1.1, 1]} : {}} transition={{repeat: Infinity, duration: 1.5}}
                  className="relative">
        <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow-md">
          <circle cx="12" cy="12" r="10" fill={color} stroke="white" strokeWidth="2"/>
          <circle cx="12" cy="12" r="4" fill="white" opacity="0.4"/>
        </svg>
        {isWinner && (
          <motion.div className="absolute -top-1 -right-1 text-sm" animate={{rotate: [0, 10, -10, 0]}}
                      transition={{repeat: Infinity, duration: 0.5}}>
            ⭐
          </motion.div>
        )}
      </motion.div>

      {isLoser && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-xs"
              style={{ left: (i - 1) * 6 }}
              animate={{ y: [0, -8, -12], opacity: [1, 0.8, 0], scale: [1, 1.2, 0.8] }}
              transition={{ repeat: Infinity, duration: 1.2 + i * 0.2, delay: i * 0.15 }}
            >
              🔥
            </motion.div>
          ))}
        </div>
      )}

      <motion.div
        initial={{opacity: 0, y: 5}}
        animate={{opacity: 1, y: 0}}
        transition={{delay: 0.2}}
        className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
          isLoser ? "bg-red-500 text-white" : isWinner ? "bg-yellow-400 text-black" : "bg-background border text-foreground"
        }`}
      >
        {name}
      </motion.div>
    </div>
  );
}

function GameOverPhase() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center text-3xl">🎉 Game Over 🎉</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center text-muted-foreground">Thanks for playing!</p>
      </CardContent>
    </Card>
  );
}

type RankedPlayer = RoomPublic["players"][number] & {
  rank: number;
  isTied: boolean;
};

function computeRankedPlayers(players: RoomPublic["players"]): RankedPlayer[] {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  let lastScore: number | null = null;
  let lastRank = 0;

  return sorted.map((p, i) => {
    const rank = p.score === lastScore ? lastRank : i + 1;
    if (p.score !== lastScore) lastRank = rank;
    lastScore = p.score;

    const isTied =
      (i > 0 && p.score === sorted[i - 1]!.score) ||
      (i + 1 < sorted.length && p.score === sorted[i + 1]!.score);

    return {...p, rank, isTied};
  });
}

function getPlayerStyle(playerId: string, voted: boolean, winners: string[], losers: string[]): string {
  if (winners.includes(playerId)) return "bg-yellow-100 border-l-4 border-yellow-400";
  if (losers.includes(playerId)) return "bg-red-100 border-l-4 border-red-400";
  if (voted) return "bg-green-50 border-l-4 border-green-400";
  return "bg-background border-l-4 border-transparent";
}

function getMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

function getDartPosition(diff: number, maxDiff: number, index: number, center: number, boardRadius: number) {
  const normalized = Math.min(Math.abs(diff) / maxDiff, 1);
  const distance = 12 + normalized * (boardRadius - 20);
  const angle = ((index * 137.5 + 45) % 360) * Math.PI / 180;
  return {x: center + Math.cos(angle) * distance, y: center + Math.sin(angle) * distance};
}

function getMissPosition(index: number, center: number, boardRadius: number) {
  const angle = ((index * 90 + 45) % 360) * Math.PI / 180;
  const distance = boardRadius + 25 + (index % 3) * 15;
  return {x: center + Math.cos(angle) * distance, y: center + Math.sin(angle) * distance};
}
