"use client";

import { useState, useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === "undefined") return true;
    return navigator.onLine;
  });
  const [showReconnecting, setShowReconnecting] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnecting(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white dark:bg-amber-600">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="size-4" />
        <span>You are offline. Some features may be limited.</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 text-white hover:bg-amber-600 hover:text-white"
          onClick={() => {
            setShowReconnecting(true);
            window.location.reload();
          }}
        >
          <RefreshCw className={`mr-1 size-3 ${showReconnecting ? "animate-spin" : ""}`} />
          Retry
        </Button>
      </div>
    </div>
  );
}
