"use client";

import { Suspense, type ReactNode } from "react";

function SectionSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-slate-50 p-6 dark:bg-slate-800/50">
      <div className="mb-4 h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="space-y-3">
        <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export function LazySection({ children }: { children: ReactNode }) {
  return <Suspense fallback={<SectionSkeleton />}>{children}</Suspense>;
}
