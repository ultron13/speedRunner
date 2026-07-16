"use client";

import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";
import { useTestStore } from "@/store/test-store";

type Report = {
  id: string;
  name: string;
  reportType: string;
  summary: string;
  createdAt: string;
  runId?: string;
};

export default function ReportsPage() {
  const runs = useTestStore((s) => s.runs);
  const hydrate = useTestStore((s) => s.hydrate);
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
    void load();
  }, [hydrate]);

  async function load() {
    if (!isGoBackendEnabled()) {
      setReports([]);
      return;
    }
    try {
      const data = await apiClient.getReports();
      setReports(
        (data || []).map((r) => ({
          id: r.id as string,
          name: r.name as string,
          reportType: (r.reportType as string) || "ENGINEERING",
          summary: (r.summary as string) || "",
          createdAt: (r.createdAt as string) || "",
          runId: r.runId as string | undefined,
        })),
      );
    } catch {
      setReports([]);
    }
  }

  async function generateFromLatest() {
    const completed = runs.find(
      (r) => r.status === "completed" || r.status === "stopped",
    );
    if (!completed) {
      setMsg("No completed runs available to report on.");
      return;
    }
    if (!isGoBackendEnabled()) {
      setMsg("Connect NEXT_PUBLIC_API_URL to generate durable reports.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.createReport({
        name: `Engineering report — ${completed.testName}`,
        runId: completed.id,
        reportType: "ENGINEERING",
      });
      await load();
      setMsg("Report created.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to create report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate>
      <AppShell subtitle="Governance" title="Reports">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Engineering, release, SLA, and executive reports linked to run evidence.
          </p>
          <Button onClick={() => void generateFromLatest()} disabled={busy}>
            <Plus className="mr-1 size-4" />
            Generate from latest run
          </Button>
        </div>
        {msg && (
          <div className="rounded-lg border bg-slate-50 px-4 py-2 text-sm dark:bg-slate-900">
            {msg}
          </div>
        )}
        {reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <FileText className="size-10 text-slate-300" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No reports yet. Complete a test run, then generate an engineering
                report.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {reports.map((r) => (
              <Card key={r.id} className="gap-0 py-0">
                <CardHeader className="px-5 py-4">
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <p className="text-xs text-slate-500">
                    {r.reportType} · {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                  </p>
                </CardHeader>
                {r.summary && (
                  <CardContent className="px-5 pb-4 text-sm text-slate-600 dark:text-slate-400">
                    {r.summary}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </AppShell>
    </AuthGate>
  );
}
