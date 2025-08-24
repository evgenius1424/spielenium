"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

export default function LobbyPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function createRoom() {
    try {
      setLoading(true);
      const res = await fetch("/api/rooms", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create room");
      router.push(`/game/${data.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2 font-sans">
          🎯 Guess the Price! 🎯
        </h1>
        <p className="text-muted-foreground font-mono">
          Players compete to guess the closest price and win points!
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            Guess the Price — Host
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            onClick={createRoom}
            disabled={loading}
            className="h-12 text-lg"
          >
            {loading ? "Creating…" : "Create Room"}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Players join at{" "}
            <code className="px-1 py-0.5 rounded bg-muted">
              /join/&lt;ROOM_ID&gt;
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
