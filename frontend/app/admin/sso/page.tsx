"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, LogIn } from "lucide-react";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";

type OIDCStatus = {
  enabled?: boolean;
  demoMode?: boolean;
  issuer?: string;
  clientId?: string;
  redirectUrl?: string;
  scopes?: string[];
  discoveryOk?: boolean;
  discoveryError?: string;
  discovery?: Record<string, string>;
};

export default function SSOPage() {
  const [status, setStatus] = useState<OIDCStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    if (!isGoBackendEnabled()) {
      setStatus({
        enabled: true,
        demoMode: true,
        issuer: "(connect NEXT_PUBLIC_API_URL for live OIDC)",
      });
      return;
    }
    try {
      const s = await apiClient.oidcStatus();
      setStatus(s as OIDCStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load OIDC status");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function demoLogin() {
    setBusy(true);
    setError("");
    setResult("");
    try {
      if (!isGoBackendEnabled()) {
        setResult("Demo: OIDC login requires Go backend (NEXT_PUBLIC_API_URL).");
        return;
      }
      const res = await apiClient.oidcDemoLogin();
      if (res.token) {
        apiClient.setToken(res.token as string);
        try {
          localStorage.setItem("speedrunner_token", res.token as string);
        } catch {
          /* ignore */
        }
      }
      setResult(JSON.stringify(res, null, 2));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "OIDC login failed");
    } finally {
      setBusy(false);
    }
  }

  async function startRealLogin() {
    setBusy(true);
    setError("");
    try {
      const res = await apiClient.oidcBeginLogin();
      if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
        return;
      }
      setResult(JSON.stringify(res, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start OIDC");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate>
      <AppShell subtitle="Identity" title="SSO / OpenID Connect">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Real OIDC authorization-code adapter. Configure{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">
            OIDC_ISSUER
          </code>
          ,{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">
            OIDC_CLIENT_ID
          </code>
          ,{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">
            OIDC_CLIENT_SECRET
          </code>
          ,{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">
            OIDC_REDIRECT_URL
          </code>
          . Without an issuer, demo mode stays on for local testing.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <KeyRound className="size-4 text-sky-600" />
              <CardTitle className="text-base">Provider status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!status ? (
                <p className="text-slate-500">Loading…</p>
              ) : (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-slate-500">Enabled</dt>
                  <dd>{status.enabled ? "yes" : "no"}</dd>
                  <dt className="text-slate-500">Demo mode</dt>
                  <dd>{status.demoMode ? "yes" : "no"}</dd>
                  <dt className="text-slate-500">Issuer</dt>
                  <dd className="truncate">{status.issuer || "—"}</dd>
                  <dt className="text-slate-500">Client ID</dt>
                  <dd>{status.clientId || "—"}</dd>
                  <dt className="text-slate-500">Redirect</dt>
                  <dd className="truncate text-xs">{status.redirectUrl || "—"}</dd>
                  <dt className="text-slate-500">Scopes</dt>
                  <dd>{(status.scopes || []).join(" ") || "—"}</dd>
                  {status.discoveryOk !== undefined && (
                    <>
                      <dt className="text-slate-500">Discovery</dt>
                      <dd>{status.discoveryOk ? "ok" : status.discoveryError}</dd>
                    </>
                  )}
                </dl>
              )}
              <div className="flex flex-wrap gap-2 pt-3">
                <Button type="button" size="sm" variant="outline" onClick={() => load()}>
                  Refresh
                </Button>
                <Button type="button" size="sm" disabled={busy} onClick={() => demoLogin()}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                  Demo OIDC login
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy || !!status?.demoMode}
                  onClick={() => startRealLogin()}
                >
                  Start IdP redirect
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last response</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <p className="mb-2 text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <pre className="max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-900">
                {result || "—"}
              </pre>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </AuthGate>
  );
}
