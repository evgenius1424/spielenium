"use client";

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
                onCloseRound={actions.closeRound}
              />
            )}

            {room.state === "results" && room.currentItem && (
              <ResultsPhase
                key="results"
                item={room.currentItem}
                categoryType={room.selectedCategory?.type}
                diffs={diffs}
                onNext={actions.nextStep}
              />
            )}

            {room.state === "game-over" && <GameOverPhase key="game-over" />}
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
