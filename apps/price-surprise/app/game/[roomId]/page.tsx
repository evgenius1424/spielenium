"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGameRoom } from "./use-game-room";
import { computeRankedPlayers } from "./utils";
import { PAGE_FADE } from "./constants";
import {
  Header,
  Scoreboard,
  LobbyPhase,
  CategorySelectionPhase,
  GuessingPhase,
  ResultsPhase,
  GameOverPhase,
} from "./components";

export default function HostRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, diffs, winners, losers, copied, actions } = useGameRoom(roomId);
  const [dartboardRevealed, setDartboardRevealed] = useState(false);
  const [scoreSnapshot, setScoreSnapshot] = useState<Record<string, number>>({});

  // Custom close round handler that captures scores before API call
  const handleCloseRound = () => {
    if (room) {
      const snapshot: Record<string, number> = {};
      room.players.forEach(p => { snapshot[p.id] = p.score; });
      setScoreSnapshot(snapshot);
      actions.closeRound();
    }
  };

  // Reset dartboardRevealed and score snapshot when not in results phase
  useEffect(() => {
    if (room?.state !== "results") {
      setDartboardRevealed(false);
      setScoreSnapshot({});
    }
  }, [room?.state]);

  // Create display players with snapshot scores when needed
  const displayPlayers = useMemo(() => {
    if (room?.state === "results" && !dartboardRevealed && Object.keys(scoreSnapshot).length > 0) {
      return room.players.map(p => ({
        ...p,
        score: scoreSnapshot[p.id] ?? p.score
      }));
    }
    return room?.players ?? [];
  }, [room?.players, room?.state, dartboardRevealed, scoreSnapshot]);

  if (!room) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading room…</p>
      </div>
    );
  }

  const rankedPlayers = computeRankedPlayers(displayPlayers);

  return (
    <motion.div
      {...PAGE_FADE}
      className="h-screen flex flex-col overflow-hidden"
    >
      <Header room={room} copied={copied} onCopyLink={actions.copyJoinLink} />

      <div className="flex-1 flex min-h-0 relative">
        <main className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <AnimatePresence mode="wait">
            {room.state === "lobby" && (
              <LobbyPhase
                key="lobby"
                onStart={actions.startGame}
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
                onCloseRound={handleCloseRound}
              />
            )}

            {room.state === "results" && room.currentItem && (
              <ResultsPhase
                key="results"
                item={room.currentItem}
                categoryType={room.selectedCategory?.type}
                diffs={diffs}
                onNext={actions.nextStep}
                onDartboardReveal={() => setDartboardRevealed(true)}
              />
            )}

            {room.state === "game-over" && <GameOverPhase key="game-over" />}
          </AnimatePresence>
        </main>

        <aside className="absolute top-4 right-4 w-72">
          <Scoreboard
            players={rankedPlayers}
            winners={room.state === "results" && !dartboardRevealed ? [] : winners}
            losers={room.state === "results" && !dartboardRevealed ? [] : losers}
            isGameOver={room.state === "game-over"}
          />
        </aside>
      </div>
    </motion.div>
  );
}
