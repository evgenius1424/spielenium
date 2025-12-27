"use client";

import { useEffect, useState, useCallback } from "react";
import type { RoomPublic, Item } from "@/lib/rooms";
import type { PlayerDiff } from "./types";

export function useGameRoom(roomId: string) {
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
    const res = await fetch(`/api/rooms/${room.id}/start`, { method: "POST" });
    if (!res.ok) console.error("Failed to start game");
  }, [room]);

  const closeRound = useCallback(async () => {
    await fetch(`/api/rooms/${roomId}/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
  }, [roomId]);

  const nextStep = useCallback(async () => {
    await fetch(`/api/rooms/${roomId}/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: room?.categories.length ? "next" : "game-over",
      }),
    });
  }, [roomId, room?.categories.length]);

  return {
    room,
    diffs,
    winners,
    losers,
    copied,
    actions: {
      copyJoinLink,
      startGame,
      closeRound,
      nextStep,
    },
  };
}
