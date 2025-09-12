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
import { Input } from "@repo/ui/components/input";
import demoData from "../data.json";

export default function LobbyPage() {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Initialize from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("gameData");
      const storedName = localStorage.getItem("gameDataFileName");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.categories) {
          setFileName(storedName || "Uploaded data");
        } else {
          // clean invalid data
          localStorage.removeItem("gameData");
          localStorage.removeItem("gameDataFileName");
        }
      }
    } catch {
      // if parsing fails, clear
      localStorage.removeItem("gameData");
      localStorage.removeItem("gameDataFileName");
    }
  }, []);

  const hasGameData = !!fileName; // derived state to control Create button

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
        localStorage.setItem("gameDataFileName", file.name);
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
    // prevent creating a room if no data
    const raw = localStorage.getItem("gameData");
    if (!raw) {
      setError("Please upload game data before creating a room.");
      return;
    }
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
          🎯 Price Surprise! 🎯
        </h1>
        <p className="text-muted-foreground font-mono">
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
          {/* Upload JSON game data */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Upload Game Data</label>
            <Input type="file" accept=".json" onChange={handleFileUpload} />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  try {
                    if (!demoData || typeof demoData !== "object" || !("categories" in demoData)) {
                      throw new Error("Invalid demo data");
                    }
                    localStorage.setItem("gameData", JSON.stringify(demoData));
                    localStorage.setItem("gameDataFileName", "data.json");
                    setFileName("data.json");
                    setError(null);
                  } catch (e) {
                    setError("Failed to load demo data.");
                  }
                }}
              >
                Load Demo Data
              </Button>
            </div>
            {!hasGameData && (
              <p className="text-xs text-muted-foreground text-center">
                Upload a JSON file with categories and items to start — or use the demo data.
              </p>
            )}
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
                  localStorage.removeItem("gameDataFileName");
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
            disabled={loading || !hasGameData}
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
