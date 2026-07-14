"use client";

import { useEffect } from "react";

import { selectRunningTests, useTestStore } from "@/store/test-store";

export function useSimulation() {
  const runningTests = useTestStore(selectRunningTests);
  const connected = useTestStore((state) => state.connected);

  useEffect(() => {
    // Skip client-side simulation when connected to WebSocket server
    if (connected || runningTests === 0) return;

    const id = window.setInterval(() => useTestStore.getState().tick(), 1_000);
    return () => window.clearInterval(id);
  }, [connected, runningTests]);
}
