"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Category } from "@/lib/rooms";

export default function LobbyPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState<{ name: string; path: string }[]>([
    { name: "Preset 1", path: "/preset1/data.json" },
  ]);
  const router = useRouter();

  async function createRoomFromPreset(presetPath: string) {
    try {
      setLoading(true);
      const res = await fetch(presetPath);
      if (!res.ok) throw new Error("Failed to load preset JSON");
      const data = (await res.json()) as { categories: Category[] };
      if (!data.categories) throw new Error("Invalid preset format");

      // create room on server
      const roomRes = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: data.categories }),
      });

      const roomData = await roomRes.json();
      if (!roomRes.ok) throw new Error(roomData?.error || "Failed to create room");

      router.push(`/game/${roomData.id}`);
    } catch (err) {
      console.error(err);
      setError("Failed to create room from preset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        {/* Logo */}
        <img
          src="/logo.png"
          alt="Price Surprise"
          className="mx-auto h-24 sm:h-32 w-auto"
        />

        {/* Subtitle */}
        <p className="text-muted-foreground font-mono mt-4">
          Players compete to guess the closest price and win points!
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            Price Surprise — Host
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Preset buttons */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-center">Select a preset</p>
            {presets.map((preset) => (
              <Button
                key={preset.path}
                onClick={() => createRoomFromPreset(preset.path)}
                disabled={loading}
                className="h-12 text-lg"
              >
                {loading ? "Creating…" : preset.name}
              </Button>
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center mt-2">{error}</p>
          )}

          <p className="text-sm text-muted-foreground text-center mt-4">
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
