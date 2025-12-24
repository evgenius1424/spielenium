"use client";
import { Button } from "@repo/ui/components/button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2 font-sans">
          📺 Remote Display 📺
        </h1>
        <p className="text-muted-foreground font-mono">
          Control and display content remotely
        </p>
      </div>

      <div className="flex gap-4">
        <Button onClick={() => console.log("Primary button clicked!")}>
          Primary Button Demo
        </Button>
      </div>
    </div>
  );
}
