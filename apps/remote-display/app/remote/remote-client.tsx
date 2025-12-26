"use client";

import { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Input } from "@repo/ui/components/input";
import { Grid, Image, List, Loader2, Monitor, Search, Upload, Video, X } from "lucide-react";

type ContentItem = {
    id: string;
    name: string;
    type: "image" | "video";
    mimeType: string;
    size: number;
    uploadedAt: string;
};

type SessionState = {
    id: string;
    hasContent: boolean;
    currentlyDisplayed: string | null;
    connectedDevices: number;
};

type TypeFilter = "all" | "image" | "video";
type ViewMode = "grid" | "list";

// Custom hook for mobile detection - mobile-first approach
function useIsMobile() {
    const [isMobile, setIsMobile] = useState(true); // Start with mobile as default

    useEffect(() => {
        const checkMobile = () => {
            const width = window.innerWidth;
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            // Consider it desktop only if width >= 1024px AND no touch OR width >= 1200px
            const isDesktop = width >= 1024 && (!isTouchDevice || width >= 1200);
            setIsMobile(!isDesktop);
        };

        // Run immediately to avoid flash
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    return isMobile;
}

// Custom hook for session management
function useRemoteSession(sessionId: string) {
    const [session, setSession] = useState<SessionState>({
        id: sessionId,
        hasContent: false,
        currentlyDisplayed: null,
        connectedDevices: 1,
    });
    const [contentList, setContentList] = useState<ContentItem[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const es = new EventSource(`/api/sessions/${sessionId}/events`);

        es.onopen = () => setIsConnected(true);
        es.onerror = () => setIsConnected(false);

        es.addEventListener("session-state", (e: MessageEvent) => {
            setSession(JSON.parse(e.data));
        });

        es.addEventListener("content-list", (e: MessageEvent) => {
            const payload: ContentItem[] = JSON.parse(e.data);
            setContentList(payload);
            setSession((prev) => ({ ...prev, hasContent: payload.length > 0 }));
        });

        return () => es.close();
    }, [sessionId]);

    const selectContent = async (item: ContentItem) => {
        const response = await fetch(`/api/sessions/${sessionId}/display`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contentId: item.id }),
        });
        if (response.ok) {
            setSession((prev) => ({ ...prev, currentlyDisplayed: item.id }));
            // Haptic feedback on mobile
            if ('vibrate' in navigator) {
                navigator.vibrate(10);
            }
        }
    };

    const clearDisplay = async () => {
        await fetch(`/api/sessions/${sessionId}/display`, { method: "DELETE" });
        setSession((prev) => ({ ...prev, currentlyDisplayed: null }));
    };

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`/api/sessions/${sessionId}/content`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Upload failed");
            }

            const result = await response.json();
            setContentList(result.items);
            setSession((prev) => ({ ...prev, hasContent: result.items.length > 0, currentlyDisplayed: null }));
        } catch (error) {
            alert(`Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsUploading(false);
        }
    };

    return {
        session,
        contentList,
        isConnected,
        isUploading,
        selectContent,
        clearDisplay,
        uploadFile,
    };
}

// Mobile Content Search Component
function MobileContentSearch({
    contentList,
    onSelect,
}: {
    contentList: ContentItem[];
    onSelect: (item: ContentItem) => void;
}) {
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Debounced search results with 150ms delay
    const [debouncedQuery, setDebouncedQuery] = useState(query);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 150);

        return () => clearTimeout(timer);
    }, [query]);

    const results = useMemo(() => {
        const searchQuery = debouncedQuery.trim().toLowerCase();
        const filtered = searchQuery
            ? contentList.filter(item =>
                item.name.toLowerCase().includes(searchQuery)
            )
            : contentList; // Show all if no query

        return filtered.slice(0, 3); // Top 3 only
    }, [contentList, debouncedQuery]);

    const handleSelect = (item: ContentItem) => {
        // Dismiss keyboard on iOS
        inputRef.current?.blur();
        onSelect(item);
    };

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    placeholder="Search content..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 pr-10 text-base" // text-base prevents iOS zoom
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
                {query && (
                    <button
                        onClick={() => setQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-sm"
                        aria-label="Clear search"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                )}
            </div>

            <div className="rounded-lg border divide-y">
                {results.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                        {query ? "No content found" : "No content uploaded"}
                    </div>
                ) : (
                    results.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-accent text-left active:scale-95 transition-all duration-100 active:bg-accent/80 touch-manipulation"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                            {item.type === "image" ? (
                                <Image className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            ) : (
                                <Video className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="flex-1 truncate font-medium">{item.name}</span>
                            <span className="text-sm text-muted-foreground flex-shrink-0">
                                {item.size > 0 ? formatFileSize(item.size) : "External"}
                            </span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

// Mobile Empty State Component
function MobileEmptyState({
    isUploading,
    onUploadClick,
}: {
    isUploading: boolean;
    onUploadClick: () => void;
}) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No Content Yet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Upload a ZIP file with images/videos or a JSON file with content URLs
            </p>
            <Button onClick={onUploadClick} disabled={isUploading} size="lg">
                {isUploading ? (
                    <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Uploading...
                    </>
                ) : (
                    <>
                        <Upload className="w-5 h-5 mr-2" />
                        Upload Content
                    </>
                )}
            </Button>
        </div>
    );
}

// Mobile Layout Component
function MobileLayout({
    session,
    contentList,
    isConnected,
    isUploading,
    onSelect,
    onClearDisplay,
    onUpload,
}: {
    session: SessionState;
    contentList: ContentItem[];
    isConnected: boolean;
    isUploading: boolean;
    onSelect: (item: ContentItem) => void;
    onClearDisplay: () => void;
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const currentItem = contentList.find((item) => item.id === session.currentlyDisplayed);
    const hasContent = contentList.length > 0;

    const handleUploadClick = () => fileInputRef.current?.click();

    return (
        <div className="min-h-screen bg-background p-4 pb-safe flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-lg font-bold flex items-center gap-2">
                        <Monitor className="w-5 h-5" />
                        Remote
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Session: <span className="font-mono">{session.id}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Small upload button when content exists */}
                    {hasContent && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleUploadClick}
                            disabled={isUploading}
                            className="h-8 w-8 p-0"
                            aria-label="Upload content"
                        >
                            {isUploading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Upload className="w-4 h-4" />
                            )}
                        </Button>
                    )}
                    <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
                        {isConnected ? "Connected" : "Offline"}
                    </Badge>
                    {session.connectedDevices > 1 && (
                        <Badge variant="secondary" className="text-xs">
                            {session.connectedDevices}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Currently Displaying */}
            {currentItem && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <Monitor className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="truncate text-sm font-medium">{currentItem.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClearDisplay}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
                {hasContent ? (
                    <MobileContentSearch contentList={contentList} onSelect={onSelect} />
                ) : (
                    <MobileEmptyState
                        isUploading={isUploading}
                        onUploadClick={handleUploadClick}
                    />
                )}
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.json"
                onChange={onUpload}
                className="hidden"
            />
        </div>
    );
}

export default function RemoteClient() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <RemoteControlContent />
        </Suspense>
    );
}

function RemoteControlContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("session") || "demo";
    const isMobile = useIsMobile();

    const {
        session,
        contentList,
        isConnected,
        isUploading,
        selectContent,
        clearDisplay,
        uploadFile,
    } = useRemoteSession(sessionId);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".zip") && !file.name.endsWith(".json")) {
            alert("Please select a ZIP file or JSON file");
            return;
        }

        await uploadFile(file);

        // Clear file input
        event.target.value = "";
    };

    if (isMobile) {
        return (
            <MobileLayout
                session={session}
                contentList={contentList}
                isConnected={isConnected}
                isUploading={isUploading}
                onSelect={selectContent}
                onClearDisplay={clearDisplay}
                onUpload={handleFileUpload}
            />
        );
    }

    return (
        <DesktopLayout
            session={session}
            contentList={contentList}
            isConnected={isConnected}
            isUploading={isUploading}
            onSelect={selectContent}
            onClearDisplay={clearDisplay}
            onUpload={handleFileUpload}
        />
    );
}

// Desktop Layout Component (existing layout preserved for desktop)
function DesktopLayout({
    session,
    contentList,
    isConnected,
    isUploading,
    onSelect,
    onClearDisplay,
    onUpload,
}: {
    session: SessionState;
    contentList: ContentItem[];
    isConnected: boolean;
    isUploading: boolean;
    onSelect: (item: ContentItem) => void;
    onClearDisplay: () => void;
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredContent = contentList.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === "all" || item.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const currentItem = contentList.find((item) => item.id === session.currentlyDisplayed);

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="max-w-4xl mx-auto">
                <Header session={session} isConnected={isConnected} />

                {currentItem && (
                    <CurrentDisplayCard itemName={currentItem.name} onClear={onClearDisplay} />
                )}

                <ControlsCard
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    typeFilter={typeFilter}
                    onTypeFilterChange={setTypeFilter}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    isUploading={isUploading}
                    onUploadClick={() => fileInputRef.current?.click()}
                />

                <ContentDisplay
                    hasContent={session.hasContent}
                    filteredContent={filteredContent}
                    viewMode={viewMode}
                    currentlyDisplayed={session.currentlyDisplayed}
                    isUploading={isUploading}
                    onSelect={onSelect}
                    onUploadClick={() => fileInputRef.current?.click()}
                    sessionId={session.id}
                />

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,.json,application/zip,application/json"
                    onChange={onUpload}
                    className="hidden"
                />
            </div>
        </div>
    );
}

function Header({ session, isConnected }: { session: SessionState; isConnected: boolean }) {
    return (
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
                    <Badge variant="secondary">{session.connectedDevices} devices</Badge>
                )}
            </div>
        </div>
    );
}

function CurrentDisplayCard({ itemName, onClear }: { itemName: string; onClear: () => void }) {
    return (
        <Card className="mb-6">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Currently Displaying</CardTitle>
                    <Button variant="outline" size="sm" onClick={onClear}>
                        <X className="w-4 h-4 mr-1" />
                        Clear
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">{itemName}</p>
            </CardContent>
        </Card>
    );
}

type ControlsCardProps = {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    typeFilter: TypeFilter;
    onTypeFilterChange: (value: TypeFilter) => void;
    viewMode: ViewMode;
    onViewModeChange: (value: ViewMode) => void;
    isUploading: boolean;
    onUploadClick: () => void;
};

function ControlsCard({
                          searchTerm,
                          onSearchChange,
                          typeFilter,
                          onTypeFilterChange,
                          viewMode,
                          onViewModeChange,
                          isUploading,
                          onUploadClick,
                      }: ControlsCardProps) {
    return (
        <Card className="mb-6">
            <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                    <CardTitle>Content Library</CardTitle>
                    <UploadButton isUploading={isUploading} onClick={onUploadClick} variant="outline" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                            placeholder="Search content..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <TypeFilterButtons value={typeFilter} onChange={onTypeFilterChange} />
                    <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
                </div>
            </CardContent>
        </Card>
    );
}

function TypeFilterButtons({
                               value,
                               onChange,
                           }: {
    value: TypeFilter;
    onChange: (v: TypeFilter) => void;
}) {
    const filters: TypeFilter[] = ["all", "image", "video"];
    const labels: Record<TypeFilter, string> = { all: "All", image: "Images", video: "Videos" };

    return (
        <div className="flex gap-1 w-full sm:w-auto">
            {filters.map((filter) => (
                <Button
                    key={filter}
                    variant={value === filter ? "default" : "outline"}
                    size="sm"
                    onClick={() => onChange(filter)}
                    className="flex-1 sm:flex-none"
                >
                    {labels[filter]}
                </Button>
            ))}
        </div>
    );
}

function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
    return (
        <div className="flex rounded-md border">
            <Button
                variant={value === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => onChange("grid")}
                className="rounded-r-none"
            >
                <Grid className="w-4 h-4" />
            </Button>
            <Button
                variant={value === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => onChange("list")}
                className="rounded-l-none"
            >
                <List className="w-4 h-4" />
            </Button>
        </div>
    );
}

type ContentDisplayProps = {
    hasContent: boolean;
    filteredContent: ContentItem[];
    viewMode: ViewMode;
    currentlyDisplayed: string | null;
    isUploading: boolean;
    onSelect: (item: ContentItem) => void;
    onUploadClick: () => void;
    sessionId: string;
};

function ContentDisplay({
                            hasContent,
                            filteredContent,
                            viewMode,
                            currentlyDisplayed,
                            isUploading,
                            onSelect,
                            onUploadClick,
                            sessionId,
                        }: ContentDisplayProps) {
    if (!hasContent) {
        return (
            <EmptyState
                icon={Upload}
                title="No Content Available"
                description="Upload some images or videos to get started"
            >
                <UploadButton isUploading={isUploading} onClick={onUploadClick} />
            </EmptyState>
        );
    }

    if (filteredContent.length === 0) {
        return (
            <EmptyState
                icon={Search}
                title="No Content Found"
                description="Try adjusting your search or filter criteria"
            />
        );
    }

    return viewMode === "grid" ? (
        <ContentGrid items={filteredContent} currentlyDisplayed={currentlyDisplayed} onSelect={onSelect} sessionId={sessionId} />
    ) : (
        <ContentList items={filteredContent} currentlyDisplayed={currentlyDisplayed} onSelect={onSelect} sessionId={sessionId} />
    );
}

type ContentViewProps = {
    items: ContentItem[];
    currentlyDisplayed: string | null;
    onSelect: (item: ContentItem) => void;
    sessionId: string;
};

function ContentGrid({ items, currentlyDisplayed, onSelect, sessionId }: ContentViewProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
                <Card
                    key={item.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                        currentlyDisplayed === item.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => onSelect(item)}
                >
                    <CardContent className="p-3">
                        <div className="aspect-square mb-2 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                            <MediaThumbnail item={item} size="lg" sessionId={sessionId} />
                        </div>
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <ContentMeta item={item} />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function ContentList({ items, currentlyDisplayed, onSelect, sessionId }: ContentViewProps) {
    return (
        <div className="space-y-2">
            {items.map((item) => (
                <Card
                    key={item.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                        currentlyDisplayed === item.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => onSelect(item)}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                                <MediaThumbnail item={item} size="sm" sessionId={sessionId} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{item.name}</p>
                                <ContentMeta item={item} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function MediaThumbnail({ item, size, sessionId }: { item: ContentItem; size: "sm" | "lg"; sessionId: string }) {
    const iconSize = size === "lg" ? "w-8 h-8" : "w-6 h-6";

    if (item.type === "image") {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={`/api/sessions/${sessionId}/content/${item.id}`}
                alt={item.name}
                className="w-full h-full object-cover"
            />
        );
    }

    const Icon = item.type === "video" ? Video : Image;
    return <Icon className={`${iconSize} text-muted-foreground`} />;
}

function ContentMeta({ item }: { item: ContentItem }) {
    return (
        <div className="flex items-center justify-between mt-1">
            <Badge variant="secondary" className="text-xs">
                {item.type.toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground">
                {item.size > 0 ? formatFileSize(item.size) : "External"}
            </span>
        </div>
    );
}

type EmptyStateProps = {
    icon: typeof Upload;
    title: string;
    description: string;
    children?: React.ReactNode;
};

function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
    return (
        <Card>
            <CardContent className="p-8 text-center">
                <Icon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-muted-foreground mb-4">{description}</p>
                {children}
            </CardContent>
        </Card>
    );
}

type UploadButtonProps = {
    isUploading: boolean;
    onClick: () => void;
    variant?: "default" | "outline";
};

function UploadButton({ isUploading, onClick, variant = "default" }: UploadButtonProps) {
    return (
        <Button variant={variant} onClick={onClick} disabled={isUploading} className="w-full sm:w-auto">
            {isUploading ? (
                <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                </>
            ) : (
                <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Content
                </>
            )}
        </Button>
    );
}

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-background p-4 pb-safe flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-lg font-bold flex items-center gap-2">
                        <Monitor className="w-5 h-5" />
                        Remote
                    </h1>
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                </div>
                <h2 className="text-lg font-semibold mb-2">Loading Remote Control</h2>
                <p className="text-sm text-muted-foreground">Initializing session...</p>
            </div>
        </div>
    );
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}