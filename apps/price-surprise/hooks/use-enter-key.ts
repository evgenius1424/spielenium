import { useEffect, useCallback } from "react";

export function useEnterKey(callback: () => void, enabled = true) {
  const memoizedCallback = useCallback(callback, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        memoizedCallback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [memoizedCallback, enabled]);
}
