"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Input } from "@repo/ui/components/input";
import {
  Search,
  Image,
  Video,
  Monitor,
  Upload,
  Grid,
  List,
  X
} from "lucide-react";

type ContentItem = {
  id: string;
  name: string;
  type: "image" | "video";
  url: string;
  thumbnail?: string;
  size: number;
  uploadedAt: string;
};

type SessionState = {
  id: string;
  hasContent: boolean;
  currentlyDisplayed: string | null;
  connectedDevices: number;
};

function RemoteControlContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || "demo";

  const [session, setSession] = useState<SessionState>({
    id: sessionId,
    hasContent: false,
    currentlyDisplayed: null,
    connectedDevices: 1,
  });

  const [contentList, setContentList] = useState<ContentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isConnected, setIsConnected] = useState(false);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource(`/api/sessions/${sessionId}/events`);

    es.onopen = () => setIsConnected(true);
    es.onerror = () => setIsConnected(false);

    es.addEventListener("session-state", (e: MessageEvent) => {
      const payload: SessionState = JSON.parse(e.data);
      setSession(payload);
    });

    es.addEventListener("content-list", (e: MessageEvent) => {
      const payload: ContentItem[] = JSON.parse(e.data);
      setContentList(payload);
      setSession(prev => ({ ...prev, hasContent: payload.length > 0 }));
    });

    return () => es.close();
  }, [sessionId]);

  const filteredContent = contentList.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const selectContent = async (item: ContentItem) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: item.id,
          type: item.type,
          url: item.url,
          name: item.name,
        }),
      });

      if (response.ok) {
        setSession(prev => ({ ...prev, currentlyDisplayed: item.id }));
      }
    } catch (error) {
      console.error("Failed to select content:", error);
    }
  };

  const clearDisplay = async () => {
    try {
      await fetch(`/api/sessions/${sessionId}/clear`, { method: "POST" });
      setSession(prev => ({ ...prev, currentlyDisplayed: null }));
    } catch (error) {
      console.error("Failed to clear display:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const renderContentGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {filteredContent.map((item) => (
        <Card
          key={item.id}
          className={`cursor-pointer transition-all hover:shadow-lg ${
            session.currentlyDisplayed === item.id ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => selectContent(item)}
        >
          <CardContent className="p-3">
            <div className="aspect-square mb-2 rounded-md overflow-hidden bg-muted flex items-center justify-center">
              {item.type === "image" ? (
                item.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnail}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image className="w-8 h-8 text-muted-foreground" />
                )
              ) : (
                <Video className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm font-medium truncate">{item.name}</p>
            <div className="flex items-center justify-between mt-1">
              <Badge variant="secondary" className="text-xs">
                {item.type.toUpperCase()}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(item.size)}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderContentList = () => (
    <div className="space-y-2">
      {filteredContent.map((item) => (
        <Card
          key={item.id}
          className={`cursor-pointer transition-all hover:shadow-md ${
            session.currentlyDisplayed === item.id ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => selectContent(item)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                {item.type === "image" ? (
                  <Image className="w-6 h-6 text-muted-foreground" />
                ) : (
                  <Video className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {item.type.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(item.size)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Monitor className="w-6 h-6" />
              Remote Control
            </h1>
            <p className="text-muted-foreground">
              Session: <span className="font-mono">{session.id}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            {session.connectedDevices > 1 && (
              <Badge variant="secondary">
                {session.connectedDevices} devices
              </Badge>
            )}
          </div>
        </div>

        {/* Current Display Status */}
        {session.currentlyDisplayed && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Currently Displaying</CardTitle>
                <Button variant="outline" size="sm" onClick={clearDisplay}>
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {contentList.find(item => item.id === session.currentlyDisplayed)?.name}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <CardTitle>Content Library</CardTitle>
              <Button variant="outline" className="w-full sm:w-auto">
                <Upload className="w-4 h-4 mr-2" />
                Upload Content
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-1 w-full sm:w-auto">
                <Button
                  variant={typeFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter("all")}
                  className="flex-1 sm:flex-none"
                >
                  All
                </Button>
                <Button
                  variant={typeFilter === "image" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter("image")}
                  className="flex-1 sm:flex-none"
                >
                  Images
                </Button>
                <Button
                  variant={typeFilter === "video" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter("video")}
                  className="flex-1 sm:flex-none"
                >
                  Videos
                </Button>
              </div>
              <div className="flex rounded-md border">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="rounded-r-none"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-l-none"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Display */}
        {!session.hasContent ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Upload className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Content Available</h3>
              <p className="text-muted-foreground mb-4">
                Upload some images or videos to get started
              </p>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Upload Content
              </Button>
            </CardContent>
          </Card>
        ) : filteredContent.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Content Found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filter criteria
              </p>
            </CardContent>
          </Card>
        ) : (
          viewMode === "grid" ? renderContentGrid() : renderContentList()
        )}
      </div>
    </div>
  );
}

function RemoteControlFallback() {
  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <div className="text-center">
        <Monitor className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Loading Remote Control...</h2>
        <p className="text-muted-foreground">Initializing session...</p>
      </div>
    </div>
  );
}

export default function RemoteClient() {
  return (
    <Suspense fallback={<RemoteControlFallback />}>
      <RemoteControlContent />
    </Suspense>
  );
}