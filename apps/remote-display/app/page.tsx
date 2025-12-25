"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Monitor, Smartphone, Plus } from "lucide-react";

const STEPS = [
    "Create or join a session",
    "Upload content from remote",
    "Select to display instantly",
];

export default function Home() {
    const [sessionId, setSessionId] = useState("");

    const createNewSession = () => {
        setSessionId(Math.random().toString(36).substring(2, 8).toUpperCase());
    };

    const sessionQuery = sessionId ? `?session=${sessionId}` : "";

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-muted/30">
            <header className="text-center mb-12">
                <h1 className="text-4xl sm:text-6xl font-bold text-foreground mb-4 font-sans">
                    📺 Remote Display
                </h1>
                <p className="text-xl text-muted-foreground font-mono max-w-2xl">
                    Upload content and control what displays on the big screen from your phone
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
                <SessionCard
                    icon={Monitor}
                    title="Display Screen"
                    description="Open this on your main display/TV screen"
                    href={`/display${sessionQuery}`}
                    buttonText="Open Display"
                    buttonVariant="default"
                    footnote="Full-screen content display with no scrollbars"
                    sessionId={sessionId}
                    onSessionIdChange={setSessionId}
                    onGenerateSession={createNewSession}
                />
                <SessionCard
                    icon={Smartphone}
                    title="Remote Control"
                    description="Open this on your phone or tablet"
                    href={`/remote${sessionQuery}`}
                    buttonText="Open Remote"
                    buttonVariant="outline"
                    footnote="Upload content and control what displays"
                    sessionId={sessionId}
                    onSessionIdChange={setSessionId}
                    onGenerateSession={createNewSession}
                />
            </div>

            <section className="mt-12 text-center max-w-2xl">
                <h2 className="text-2xl font-semibold mb-4">How it works</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
                    {STEPS.map((step, i) => (
                        <div key={i} className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                                <span className="text-primary font-bold">{i + 1}</span>
                            </div>
                            <p className="text-muted-foreground">{step}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

type SessionCardProps = {
    icon: typeof Monitor;
    title: string;
    description: string;
    href: string;
    buttonText: string;
    buttonVariant: "default" | "outline";
    footnote: string;
    sessionId: string;
    onSessionIdChange: (value: string) => void;
    onGenerateSession: () => void;
};

function SessionCard({
                         icon: Icon,
                         title,
                         description,
                         href,
                         buttonText,
                         buttonVariant,
                         footnote,
                         sessionId,
                         onSessionIdChange,
                         onGenerateSession,
                     }: SessionCardProps) {
    return (
        <Card className="p-6">
            <CardHeader className="text-center pb-4">
                <Icon className="w-16 h-16 mx-auto mb-4 text-primary" />
                <CardTitle className="text-2xl">{title}</CardTitle>
                <p className="text-muted-foreground">{description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        placeholder="Enter session ID"
                        value={sessionId}
                        onChange={(e) => onSessionIdChange(e.target.value)}
                    />
                    <Button variant="outline" onClick={onGenerateSession}>
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
                <Link href={href} className="block">
                    <Button variant={buttonVariant} className="w-full h-12 text-lg">
                        {buttonText}
                    </Button>
                </Link>
                <p className="text-sm text-muted-foreground text-center">{footnote}</p>
            </CardContent>
        </Card>
    );
}