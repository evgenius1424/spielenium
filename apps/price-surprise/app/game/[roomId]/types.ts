import type { RoomPublic } from "@/lib/rooms";

export type PlayerDiff = {
  playerId: string;
  name: string;
  diff: number;
  guess?: number;
};

export type RankedPlayer = RoomPublic["players"][number] & {
  rank: number;
  isTied: boolean;
};

export type GameState = RoomPublic["state"];
