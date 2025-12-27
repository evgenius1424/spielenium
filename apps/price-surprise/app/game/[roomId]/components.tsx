"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Reorder } from "framer-motion";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { RoomPublic, Item } from "@/lib/rooms";
import type { RankedPlayer, PlayerDiff } from "./types";
import { POP, STAGGER } from "./constants";

interface HeaderProps {
  room: RoomPublic;
  copied: boolean;
  onCopyLink: () => void;
}

export function Header({ room, copied, onCopyLink }: HeaderProps) {
  return (
    <header className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <motion.img
          src="/logo.png"
          alt="Price Surprise"
          className="h-12 sm:h-14 w-auto"
          initial={{ rotate: -5, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
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
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
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
          onReorder={() => {}}
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
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
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

export function LobbyPhase({ onStart, disabled }: LobbyPhaseProps) {
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
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
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
  const symbol =
    categoryType === "ruble" ? "₽" : categoryType === "comparison" ? "%" : "€";

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Round Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <motion.div
          initial={{ rotateX: 90 }}
          animate={{ rotateX: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-md aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
        >
          <img
            src={item.imageAnswer}
            alt={item.name}
            className="h-full w-full object-contain"
          />
        </motion.div>
        <p className="text-center text-2xl">
          The price of{" "}
          <span className="text-primary font-bold">{item.name}</span> is{" "}
          <span className="text-primary font-bold">{item.price}</span>!
        </p>
        <motion.div
          variants={STAGGER}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
        >
          {diffs.map((d) => (
            <motion.div
              key={d.playerId}
              variants={POP}
              className="rounded-xl border p-3 text-center"
            >
              <p className="font-semibold truncate">{d.name}</p>
              {Number.isFinite(d.diff) ? (
                <>
                  <p className="text-sm text-muted-foreground">Guess</p>
                  <p className="text-xl font-bold">
                    {symbol} {d.guess}
                  </p>
                  <p className="text-sm">
                    Diff: {symbol} {Math.round(d.diff)}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">No guess</p>
              )}
            </motion.div>
          ))}
        </motion.div>
        <div className="flex justify-center">
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
