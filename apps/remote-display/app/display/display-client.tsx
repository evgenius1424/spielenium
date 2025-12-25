"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Monitor, Wifi, WifiOff } from "lucide-react";

type DisplayState = "waiting" | "showing-content" | "error";

type ContentType = "image" | "video" | "none";

type DisplaySession = {
  id: string;
  state: DisplayState;
  currentContent: {
    type: ContentType;
    url: string;
    name: string;
  } | null;
  connectedDevices: number;
};

function DisplayContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || "demo";

  const [session, setSession] = useState<DisplaySession>({
    id: sessionId,
    state: "waiting",
    currentContent: null,
    connectedDevices: 0,
  });
  const [isConnected, setIsConnected] = useState(false);

  // SSE subscription for real-time content updates
  useEffect(() => {
    const es = new EventSource(`/api/sessions/${sessionId}/events`);

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    es.addEventListener("session-state", (e: MessageEvent) => {
      const payload: DisplaySession = JSON.parse(e.data);
      setSession(payload);
    });

    es.addEventListener("content-selected", (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as {
        type: ContentType;
        url: string;
        name: string;
      };
      setSession((prev) => ({
        ...prev,
        state: "showing-content",
        currentContent: payload,
      }));
    });

    es.addEventListener("content-cleared", () => {
      setSession((prev) => ({
        ...prev,
        state: "waiting",
        currentContent: null,
      }));
    });

    return () => es.close();
  }, [sessionId]);

  const renderContent = () => {
    if (!session.currentContent) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <Monitor className="w-24 h-24 text-muted-foreground mb-6" />
          <h2 className="text-4xl font-bold mb-4 text-foreground">
            Waiting for Content
          </h2>
          <p className="text-xl text-muted-foreground mb-2">
            Use your remote device to select content to display
          </p>
          <p className="text-lg text-muted-foreground">
            Session ID:{" "}
            <span className="font-mono font-bold">{session.id}</span>
          </p>
        </div>
      );
    }

    const { type, url, name } = session.currentContent;

    if (type === "image") {
      return (
        <div className="flex items-center justify-center h-full p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={name}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            onError={() => setSession((prev) => ({ ...prev, state: "error" }))}
          />
        </div>
      );
    }

    if (type === "video") {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-full rounded-lg shadow-lg"
            onError={() => setSession((prev) => ({ ...prev, state: "error" }))}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    return null;
  };

  const renderStatusBar = () => (
    <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
      <div className="flex items-center gap-2">
        <Badge
          variant={isConnected ? "default" : "destructive"}
          className="flex items-center gap-1"
        >
          {isConnected ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>
        {session.connectedDevices > 0 && (
          <Badge variant="secondary">
            {session.connectedDevices} device
            {session.connectedDevices !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline">Session: {session.id}</Badge>
        {session.currentContent && (
          <Badge variant="default">{session.currentContent.name}</Badge>
        )}
      </div>
    </div>
  );

  if (session.state === "error") {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center relative">
        {renderStatusBar()}
        <Card className="p-8 text-center max-w-md">
          <div className="text-destructive text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Content Error</h2>
          <p className="text-muted-foreground">
            Failed to load the selected content. Please try selecting different
            content.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background overflow-hidden relative">
      {renderStatusBar()}
      <div className="h-full w-full pt-16">{renderContent()}</div>
    </div>
  );
}

function DisplayFallback() {
  return (
    <div className="h-screen w-full bg-background flex items-center justify-center">
      <div className="text-center">
        <Monitor className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Loading Display...</h2>
        <p className="text-muted-foreground">Initializing session...</p>
      </div>
    </div>
  );
}

export default function DisplayClient() {
  return (
    <Suspense fallback={<DisplayFallback />}>
      <DisplayContent />
    </Suspense>
  );
}
