"use client";

import { useCallback, useEffect, useState } from "react";
import { Bug, Link2, Loader2, Search } from "lucide-react";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";

type Connector = {
  id: string;
  name: string;
  category: string;
  status: string;
};

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [jiraStatus, setJiraStatus] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [projectKey, setProjectKey] = useState("PERF");
  const [summary, setSummary] = useState("Checkout p95 regression");
  const [searchOut, setSearchOut] = useState("");

  const load = useCallback(async () => {
    if (!isGoBackendEnabled()) {
      setConnectors([
        { id: "jira", name: "Jira", category: "itsm", status: "available" },
        { id: "slack", name: "Slack", category: "chat", status: "available" },
      ]);
      setJiraStatus({ demoMode: true, configured: false });
      return;
    }
    try {
      const [c, j] = await Promise.all([
        apiClient.getConnectors(),
        apiClient.jiraStatus(),
      ]);
      setConnectors(c as Connector[]);
      setJiraStatus(j);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Load failed");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function connect(id: string) {
    if (!isGoBackendEnabled()) return;
    setBusy(true);
    try {
      await apiClient.connectorAction({
        action: "connect",
        id,
        config: { note: "connected from UI" },
      });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function createJiraIssue() {
    setBusy(true);
    setMsg("");
    try {
      if (!isGoBackendEnabled()) {
        setMsg("Demo issue PERF-42 created (connect API for real Jira)");
        return;
      }
      const issue = await apiClient.jiraCreateIssue({
        projectKey,
        summary,
        description: "Filed from SpeedRunner Connectors UI",
        issueType: "Bug",
        labels: ["performance", "speedrunner"],
      });
      setMsg(`Created ${String(issue.key)} (${issue.id})`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Jira create failed");
    } finally {
      setBusy(false);
    }
  }

  async function searchJira() {
    setBusy(true);
    try {
      if (!isGoBackendEnabled()) {
        setSearchOut(JSON.stringify({ total: 1, issues: [{ key: "DEMO-1" }] }, null, 2));
        return;
      }
      const res = await apiClient.jiraSearch({
        jql: `project = ${projectKey} ORDER BY created DESC`,
        maxResults: 10,
      });
      setSearchOut(JSON.stringify(res, null, 2));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function defectFromRun() {
    setBusy(true);
    try {
      if (!isGoBackendEnabled()) {
        setMsg("Demo defect PERF-99 from run");
        return;
      }
      const issue = await apiClient.jiraDefectFromRun({
        projectKey,
        runId: "run-demo-1",
        testName: "Checkout Load",
        errorRate: 3.5,
        p95: 920,
        evidenceURL: "https://speedrunner.local/runs/run-demo-1",
      });
      setMsg(`Defect ${String(issue.key)} filed from run evidence`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Defect draft failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate>
      <AppShell subtitle="Partner hub" title="Connectors & Jira">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Real Jira REST adapter (Cloud API v3). Set{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">
            JIRA_BASE_URL
          </code>
          ,{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">
            JIRA_EMAIL
          </code>
          ,{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">
            JIRA_API_TOKEN
          </code>
          . Without credentials, demo mode returns simulated issues.
        </p>

        {msg && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100">
            {msg}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <Link2 className="size-4 text-sky-600" />
              <CardTitle className="text-base">Connector catalog</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {connectors.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm dark:border-slate-800"
                >
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-slate-500">
                      {c.category} · {c.status}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || c.status === "connected"}
                    onClick={() => connect(c.id)}
                  >
                    {c.status === "connected" ? "Connected" : "Connect"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <Bug className="size-4 text-orange-600" />
              <CardTitle className="text-base">Jira adapter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-500">Configured</dt>
                <dd>{String(jiraStatus?.configured ?? false)}</dd>
                <dt className="text-slate-500">Demo mode</dt>
                <dd>{String(jiraStatus?.demoMode ?? true)}</dd>
                <dt className="text-slate-500">Base URL</dt>
                <dd className="truncate">{String(jiraStatus?.baseUrl || "—")}</dd>
              </dl>
              <label className="block text-xs font-medium">
                Project key
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium">
                Summary
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={busy} onClick={() => createJiraIssue()}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Bug className="size-4" />}
                  Create issue
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => searchJira()}>
                  <Search className="size-4" /> Search
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => defectFromRun()}>
                  Defect from run
                </Button>
              </div>
              {searchOut && (
                <pre className="max-h-48 overflow-auto rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-900">
                  {searchOut}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </AuthGate>
  );
}
