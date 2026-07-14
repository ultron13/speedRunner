"use client";

import { Play, Square, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTestStore } from "@/store/test-store";

export function BulkActions() {
  const selectedTestIds = useTestStore((state) => state.selectedTestIds);
  const clearTestSelection = useTestStore((state) => state.clearTestSelection);
  const bulkStartTests = useTestStore((state) => state.bulkStartTests);
  const bulkStopTests = useTestStore((state) => state.bulkStopTests);
  const bulkDeleteTests = useTestStore((state) => state.bulkDeleteTests);
  const tests = useTestStore((state) => state.tests);

  if (selectedTestIds.length === 0) return null;

  const selectedTests = tests.filter((t) => selectedTestIds.includes(t.id));
  const canStart = selectedTests.some((t) => t.status === "idle" || t.status === "completed");
  const canStop = selectedTests.some((t) => t.status === "running");

  return (
    <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-lg border bg-white p-3 shadow-lg dark:bg-slate-900">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">
          {selectedTestIds.length} test{selectedTestIds.length !== 1 ? "s" : ""} selected
        </span>
        <div className="flex gap-1">
          {canStart && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const idleIds = selectedTests
                  .filter((t) => t.status === "idle" || t.status === "completed")
                  .map((t) => t.id);
                bulkStartTests(idleIds);
              }}
            >
              <Play className="mr-1 size-3" />
              Start
            </Button>
          )}
          {canStop && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const runningIds = selectedTests
                  .filter((t) => t.status === "running")
                  .map((t) => t.id);
                bulkStopTests(runningIds);
              }}
            >
              <Square className="mr-1 size-3" />
              Stop
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm(`Delete ${selectedTestIds.length} test(s)?`)) {
                bulkDeleteTests(selectedTestIds);
              }
            }}
            className="text-rose-600 hover:text-rose-700"
          >
            <Trash2 className="mr-1 size-3" />
            Delete
          </Button>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={clearTestSelection}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
