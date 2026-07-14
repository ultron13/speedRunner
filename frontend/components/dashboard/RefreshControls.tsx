"use client";

import { useEffect } from "react";
import { RefreshCw, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboardStore } from "@/store/dashboard-store";
import { useTestStore } from "@/store/test-store";

const refreshIntervals = [
  { value: 10_000, label: "10 seconds" },
  { value: 30_000, label: "30 seconds" },
  { value: 60_000, label: "1 minute" },
  { value: 300_000, label: "5 minutes" },
];

export function RefreshControls() {
  const refreshConfig = useDashboardStore((state) => state.refreshConfig);
  const setRefreshEnabled = useDashboardStore((state) => state.setRefreshEnabled);
  const setRefreshInterval = useDashboardStore((state) => state.setRefreshInterval);
  const markRefreshed = useDashboardStore((state) => state.markRefreshed);
  const hydrate = useTestStore((state) => state.hydrate);
  const hydrated = useTestStore((state) => state.hydrated);

  // Auto-refresh effect
  useEffect(() => {
    if (!refreshConfig.enabled || !hydrated) return;

    const interval = setInterval(() => {
      // Re-hydrate to refresh data
      hydrate();
      markRefreshed();
    }, refreshConfig.intervalMs);

    return () => clearInterval(interval);
  }, [refreshConfig.enabled, refreshConfig.intervalMs, hydrated, hydrate, markRefreshed]);

  const handleManualRefresh = () => {
    hydrate();
    markRefreshed();
  };

  const formatLastRefreshed = () => {
    if (!refreshConfig.lastRefreshedAt) return "Never";
    const date = new Date(refreshConfig.lastRefreshedAt);
    return date.toLocaleTimeString("en", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="flex items-center gap-3">
      {/* Last refreshed */}
      <div className="hidden items-center gap-1 text-xs text-slate-500 sm:flex">
        <Clock className="size-3" />
        <span>Last: {formatLastRefreshed()}</span>
      </div>

      {/* Auto-refresh toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500">Auto-refresh:</label>
        <Select
          value={refreshConfig.enabled ? String(refreshConfig.intervalMs) : "off"}
          onValueChange={(value) => {
            if (value === "off") {
              setRefreshEnabled(false);
            } else {
              setRefreshInterval(Number(value));
              setRefreshEnabled(true);
            }
          }}
        >
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off</SelectItem>
            {refreshIntervals.map((interval) => (
              <SelectItem key={interval.value} value={String(interval.value)}>
                {interval.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Manual refresh */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleManualRefresh}
        aria-label="Refresh data"
        title="Refresh now"
      >
        <RefreshCw className="size-4 text-slate-500" />
      </Button>
    </div>
  );
}
