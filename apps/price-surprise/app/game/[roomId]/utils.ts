import type { RoomPublic } from "@/lib/rooms";
import type { RankedPlayer } from "./types";

export function computeRankedPlayers(
  players: RoomPublic["players"],
): RankedPlayer[] {
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

    return { ...p, rank, isTied };
  });
}
