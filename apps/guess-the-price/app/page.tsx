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
import { Input } from "@repo/ui/components/input";

export default function LobbyPage() {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.categories || typeof data.categories !== "object") {
          throw new Error("Invalid data format");
        }
        localStorage.setItem("gameData", JSON.stringify(data));
        setFileName(file.name);
        setError(null);
      } catch (err) {
        setError("Failed to parse the file. Ensure it is a valid JSON file.");
      }
    };
    reader.onerror = () => {
      setError("Failed to read the file.");
    };
    reader.readAsText(file);
  };

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
          {/* Upload JSON game data */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Upload Game Data</label>
            <Input type="file" accept=".json" onChange={handleFileUpload} />
            {fileName && (
              <p className="text-sm text-green-600 text-center">
                Uploaded: {fileName}
              </p>
            )}
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            {fileName && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.removeItem("gameData");
                  setFileName(null);
                }}
              >
                Clear Uploaded Data
              </Button>
            )}
          </div>

          {/* Create Room */}
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
