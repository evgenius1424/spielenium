"use client";

import {useEffect, useMemo, useState} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {Reorder} from "framer-motion";
import {Badge} from "@repo/ui/components/badge";
import {Button} from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type {RoomPublic, Item} from "@/lib/rooms";
import type {RankedPlayer, PlayerDiff} from "./types";
import {POP, STAGGER, DART_COLORS} from "./constants";

interface HeaderProps {
  room: RoomPublic;
  copied: boolean;
  onCopyLink: () => void;
}

export function Header({room, copied, onCopyLink}: HeaderProps) {
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

interface ScoreboardProps {
  players: RankedPlayer[];
  winners: string[];
  losers: string[];
  isGameOver: boolean;
}

export function Scoreboard({
                             players,
                             winners,
                             losers,
                             isGameOver,
                           }: ScoreboardProps) {
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

interface LobbyPhaseProps {
  onStart: () => void;
  disabled: boolean;
}

export function LobbyPhase({onStart, disabled}: LobbyPhaseProps) {
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

interface CategorySelectionPhaseProps {
  pickerName?: string;
  categories: RoomPublic["categories"];
}

export function CategorySelectionPhase({
                                         pickerName,
                                         categories,
                                       }: CategorySelectionPhaseProps) {
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

interface GuessingPhaseProps {
  item: Item;
  categoryName?: string;
  onCloseRound: () => void;
}

export function GuessingPhase({
                                item,
                                categoryName,
                                onCloseRound,
                              }: GuessingPhaseProps) {
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

interface ResultsPhaseProps {
  item: Item;
  categoryType?: string;
  diffs: PlayerDiff[];
  onNext: () => void;
}

export function ResultsPhase({
                               item,
                               categoryType,
                               diffs,
                               onNext,
                             }: ResultsPhaseProps) {
  const [revealedDarts, setRevealedDarts] = useState<string[]>([]);

  const symbol =
    categoryType === "ruble" ? "₽" : categoryType === "comparison" ? "%" : "€";

  const sortedDiffs = useMemo(
    () => [...diffs].sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff)),
    [diffs]
  );

  const maxDiff = useMemo(
    () =>
      Math.max(
        ...diffs
          .filter((d) => Number.isFinite(d.diff))
          .map((d) => Math.abs(d.diff)),
        1
      ),
    [diffs]
  );

  const perfectGuessers = useMemo(
    () => diffs.filter((d) => d.diff === 0),
    [diffs]
  );

  const hasPerfectGuess = perfectGuessers.length > 0;

  const winners = useMemo(
    () =>
      sortedDiffs.length > 0 && Number.isFinite(sortedDiffs[0]?.diff)
        ? sortedDiffs
          .filter((d) => d.diff === sortedDiffs[0]!.diff)
          .map((d) => d.playerId)
        : [],
    [sortedDiffs]
  );

  const losers = useMemo(
    () => diffs.filter((d) => !Number.isFinite(d.diff)).map((d) => d.playerId),
    [diffs]
  );

  useEffect(() => {
    setRevealedDarts([]);
    const timeouts: NodeJS.Timeout[] = [];
    sortedDiffs.forEach((d, i) => {
      const timeout = setTimeout(
        () => setRevealedDarts((prev) => [...prev, d.playerId]),
        i * 300 + 500
      );
      timeouts.push(timeout);
    });
    return () => timeouts.forEach(clearTimeout);
  }, [sortedDiffs]);

  return (
    <Card className="w-full max-w-4xl relative overflow-hidden">
      {hasPerfectGuess && (
        <PerfectGuessOverlay
          playerName={perfectGuessers.map((p) => p.name).join(" & ")}
        />
      )}
      <CardHeader>
        <CardTitle className="text-center text-2xl">
          {hasPerfectGuess ? "🎯✨ Round Results ✨🎯" : "🎯 Round Results"}
        </CardTitle>
        <p className="text-center text-lg text-muted-foreground">
          <span className="font-bold text-foreground">{item.name}</span> costs{" "}
          <span className="font-bold text-primary">
            {symbol}
            {item.price}
          </span>
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <DartsBoard
            diffs={diffs}
            winners={winners}
            losers={losers}
            maxDiff={maxDiff}
            revealedDarts={revealedDarts}
            actualPrice={item.price}
          />
        </div>

        <div className="space-y-2">
          {sortedDiffs.map((d, i) => {
            const isWinner = winners.includes(d.playerId);
            const isLoser = losers.includes(d.playerId);
            const isPerfect = d.diff === 0;
            const color =
              DART_COLORS[
              diffs.findIndex((x) => x.playerId === d.playerId) %
              DART_COLORS.length
                ];
            const hasGuess = Number.isFinite(d.diff);

            return (
              <motion.div
                key={d.playerId}
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  y: 0,
                  boxShadow: isPerfect
                    ? [
                      "0 0 0 0 rgba(234, 179, 8, 0)",
                      "0 0 20px 4px rgba(234, 179, 8, 0.4)",
                      "0 0 0 0 rgba(234, 179, 8, 0)",
                    ]
                    : "none",
                }}
                transition={{
                  scale: { duration: 0.3, delay: i * 0.15 },
                  opacity: { duration: 0.3, delay: i * 0.15 },
                  y: { duration: 0.3, delay: i * 0.15 },
                  boxShadow: isPerfect
                    ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0 },
                }}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isPerfect
                    ? "bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 border-yellow-500"
                    : isWinner
                      ? "bg-yellow-500/10 border-yellow-500/50"
                      : isLoser
                        ? "bg-red-500/10 border-red-500/50"
                        : "bg-muted/30 border-border"
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate flex items-center gap-2">
                    {d.name}
                    {isPerfect && <span>🎯💯</span>}
                    {isWinner && !isPerfect && <span>🏆</span>}
                    {isLoser && <span className="text-sm">💀🔥</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {hasGuess ? `Guessed: ${symbol}${d.guess}` : "No guess"}
                  </p>
                </div>
                {hasGuess && (
                  <div
                    className={`text-right ${isPerfect ? "text-yellow-500" : isWinner ? "text-green-500" : isLoser ? "text-red-500" : "text-foreground"}`}
                  >
                    <p className="text-xl font-bold">
                      {isPerfect
                        ? "PERFECT!"
                        : `${d.guess! > item.price ? "+" : "-"}${Math.round(Math.abs(d.diff))}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isPerfect ? "🎉🎉🎉" : "difference"}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="flex justify-center relative z-10">
          <Button onClick={onNext} className="h-12 px-8 text-lg">
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
export function GameOverPhase() {
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

interface DartsBoardProps {
  diffs: PlayerDiff[];
  winners: string[];
  losers: string[];
  maxDiff: number;
  revealedDarts: string[];
  actualPrice: number;
}

interface DartsBoardProps {
  diffs: PlayerDiff[];
  winners: string[];
  losers: string[];
  maxDiff: number;
  revealedDarts: string[];
  actualPrice: number;
}

function DartsBoard({
                      diffs,
                      winners,
                      losers,
                      maxDiff,
                      revealedDarts,
                      actualPrice,
                    }: DartsBoardProps) {
  const size = 320;
  const center = size / 2;
  const boardRadius = 130;
  const ringRadii = [130, 105, 80, 55, 30, 12];
  const ringColors = [
    "#1a1a2e",
    "#16213e",
    "#0f3460",
    "#e94560",
    "#0f3460",
    "#e94560",
  ];

  return (
    <motion.div
      initial={{scale: 0.9, opacity: 0}}
      animate={{scale: 1, opacity: 1}}
      transition={{duration: 0.4, type: "spring"}}
      className="relative overflow-visible"
      style={{width: size, height: size}}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-full drop-shadow-xl"
      >
        <defs>
          <radialGradient id="boardShine" cx="35%" cy="35%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0.1)"/>
          </radialGradient>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={boardRadius + 10}
          fill="#2a2a3a"
          stroke="#444"
          strokeWidth="4"
        />

        {ringRadii.map((r, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={r}
            fill={ringColors[i]}
            stroke="#333"
            strokeWidth="1"
          />
        ))}

        <circle
          cx={center}
          cy={center}
          r={ringRadii[ringRadii.length - 1]}
          fill="#ffd700"
        />

        {[...Array(8)].map((_, i) => {
          const angle = (i * 45 * Math.PI) / 180;
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
      </svg>

      <AnimatePresence>
        {diffs.map((d, i) => {
          if (!revealedDarts.includes(d.playerId)) return null;
          const isLoser =
            losers.includes(d.playerId) || !Number.isFinite(d.diff);
          const isWinner = winners.includes(d.playerId);
          const color = DART_COLORS[i % DART_COLORS.length];
          const pos = isLoser
            ? getMissPosition(i, center, boardRadius)
            : getDartPosition(d.diff, maxDiff, i, center, boardRadius, actualPrice);

          return (
            <motion.div
              key={d.playerId}
              initial={{left: center + 100, top: -50, scale: 0.5, opacity: 0}}
              animate={{
                left: pos.x - 12,
                top: pos.y - 12,
                scale: 1,
                opacity: 1,
              }}
              transition={{type: "spring", stiffness: 300, damping: 20}}
              className="absolute"
              style={{zIndex: isWinner ? 20 : 10}}
            >
              <DartPin
                color={color!}
                isWinner={isWinner}
                isLoser={isLoser}
                name={d.name}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

interface DartPinProps {
  color: string;
  isWinner: boolean;
  isLoser: boolean;
  name: string;
}

function DartPin({color, isWinner, isLoser, name}: DartPinProps) {
  return (
    <div className="relative">
      <motion.div
        animate={isWinner ? {scale: [1, 1.15, 1]} : {}}
        transition={{repeat: Infinity, duration: 2, ease: "easeInOut"}}
        className="relative"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          className="drop-shadow-md"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            fill={color}
            stroke="white"
            strokeWidth="2"
          />
          <circle cx="12" cy="12" r="4" fill="white" opacity="0.4"/>
        </svg>
        {isWinner && (
          <motion.div
            className="absolute -top-1 -right-1 text-sm"
            animate={{rotate: [0, 15, -15, 0]}}
            transition={{repeat: Infinity, duration: 1.5, ease: "easeInOut"}}
          >
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
              style={{left: (i - 1) * 6}}
              animate={{
                y: [0, -10, -16],
                opacity: [1, 0.7, 0],
                scale: [0.9, 1.1, 0.7],
              }}
              transition={{
                repeat: Infinity,
                duration: 2 + i * 0.3,
                delay: i * 0.4,
                ease: "easeOut",
              }}
            >
              🔥
            </motion.div>
          ))}
        </div>
      )}

      <motion.div
        initial={{opacity: 0, y: 5}}
        animate={{opacity: 1, y: 0}}
        transition={{delay: 0.3, duration: 0.4}}
        className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
          isLoser
            ? "bg-red-500 text-white"
            : isWinner
              ? "bg-yellow-400 text-black"
              : "bg-background border text-foreground"
        }`}
      >
        {name}
      </motion.div>
    </div>
  );
}

interface PerfectGuessOverlayProps {
  playerName: string;
}

function PerfectGuessOverlay({playerName}: PerfectGuessOverlayProps) {
  const confetti = useMemo(() => {
    const emojis = ["🎉", "🎊", "🏆", "⭐", "💰", "🔥", "💎", "👑"];
    return [...Array(30)].map((_, i) => ({
      id: i,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      left: Math.random() * 100,
      duration: Math.random() * 3 + 3,
      delay: Math.random() * 2,
      rotate: Math.random() * 360 - 180,
    }));
  }, []);

  const bursts = useMemo(() => {
    const colors = ["#ffd700", "#ff6b6b", "#4ecdc4", "#a55eea", "#26de81", "#fd79a8"];
    return [...Array(8)].map((_, i) => ({
      id: i,
      color: colors[i % colors.length],
      x: Math.cos((i * 45 * Math.PI) / 180) * 120,
      y: Math.sin((i * 45 * Math.PI) / 180) * 120,
    }));
  }, []);

  return (
    <>
      {confetti.map((c) => (
        <motion.div
          key={c.id}
          className="absolute text-2xl pointer-events-none"
          style={{left: `${c.left}%`}}
          initial={{y: -30, opacity: 1, rotate: 0}}
          animate={{
            y: "100vh",
            rotate: c.rotate,
          }}
          transition={{
            duration: c.duration,
            delay: c.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {c.emoji}
        </motion.div>
      ))}

      {bursts.map((b) => (
        <motion.div
          key={`burst-${b.id}`}
          className="absolute left-1/2 top-1/3 w-3 h-3 rounded-full pointer-events-none"
          style={{background: b.color}}
          initial={{x: "-50%", y: "-50%", scale: 0, opacity: 1}}
          animate={{
            x: `calc(-50% + ${b.x}px)`,
            y: `calc(-50% + ${b.y}px)`,
            scale: [0, 1, 0],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 1.5,
            delay: 0.5,
            repeat: Infinity,
            repeatDelay: 1,
          }}
        />
      ))}
    </>
  );
}

function getPlayerStyle(
  playerId: string,
  voted: boolean,
  winners: string[],
  losers: string[],
): string {
  if (winners.includes(playerId))
    return "bg-yellow-100 border-l-4 border-yellow-400";
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

function getDartPosition(
  diff: number,
  maxDiff: number,
  index: number,
  center: number,
  boardRadius: number,
  actualPrice: number
) {
  const absDiff = Math.abs(diff);
  const percentOff = absDiff / actualPrice;

  let distance: number;

  if (percentOff <= 0.05) {
    distance = 12 + (percentOff / 0.05) * 18;
  } else if (percentOff <= 0.15) {
    distance = 30 + ((percentOff - 0.05) / 0.1) * 40;
  } else if (percentOff <= 0.30) {
    distance = 70 + ((percentOff - 0.15) / 0.15) * 40;
  } else if (percentOff <= 0.50) {
    distance = 110 + ((percentOff - 0.30) / 0.2) * 20;
  } else if (percentOff <= 1.0) {
    distance = boardRadius + 20 + ((percentOff - 0.5) / 0.5) * 30;
  } else {
    distance = boardRadius + 50 + Math.min((percentOff - 1.0) * 20, 40);
  }

  const angle = (((index * 137.5 + 45) % 360) * Math.PI) / 180;
  return {
    x: center + Math.cos(angle) * distance,
    y: center + Math.sin(angle) * distance,
  };
}

function getMissPosition(index: number, center: number, boardRadius: number) {
  const angle = (((index * 90 + 45) % 360) * Math.PI) / 180;
  const distance = boardRadius + 25 + (index % 3) * 15;
  return {
    x: center + Math.cos(angle) * distance,
    y: center + Math.sin(angle) * distance,
  };
}
