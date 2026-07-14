"use client";

import { Play, Square, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTestStore } from "@/store/test-store";
import type { TestStatus } from "@/types";

export function TestActions({ testId, status }: { testId: string; status: TestStatus }) {
  const startTest = useTestStore((state) => state.dispatchStartTest);
  const stopTest = useTestStore((state) => state.dispatchStopTest);
  const deleteTest = useTestStore((state) => state.dispatchDeleteTest);

  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon-sm" aria-label="Start test" title="Start test" disabled={status === "running"} onClick={() => startTest(testId)}>
        <Play className="size-4 text-sky-700" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Stop test" title="Stop test" disabled={status !== "running"} onClick={() => stopTest(testId)}>
        <Square className="size-3.5 text-amber-700" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete test"
        title="Delete test"
        onClick={() => {
          if (window.confirm("Delete this test? This action cannot be undone.")) deleteTest(testId);
        }}
      >
        <Trash2 className="size-4 text-rose-700" />
      </Button>
    </div>
  );
}
