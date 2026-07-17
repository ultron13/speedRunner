"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Plus } from "lucide-react";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";

type Tenant = {
  id: string;
  name: string;
  plan: string;
  region: string;
  status: string;
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("team");
  const [region, setRegion] = useState("us-east-1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isGoBackendEnabled()) {
      setTenants([
        {
          id: "default",
          name: "Default Workspace",
          plan: "enterprise",
          region: "us-east-1",
          status: "active",
        },
      ]);
      return;
    }
    try {
      const list = await apiClient.getTenants();
      setTenants(list as Tenant[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tenants");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (!isGoBackendEnabled()) {
        setTenants((t) => [
          ...t,
          {
            id: `t-${Date.now()}`,
            name,
            plan,
            region,
            status: "active",
          },
        ]);
        setName("");
        return;
      }
      await apiClient.upsertTenant({ name, plan, region, status: "active" });
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate>
      <AppShell subtitle="Multi-tenant SaaS" title="Tenants">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Workspace isolation with plan tiers (free / team / enterprise) and home region.
        </p>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <Plus className="size-4 text-sky-600" />
              <CardTitle className="text-base">New tenant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-xs font-medium">
                Name
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium">
                Plan
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                >
                  <option value="free">free</option>
                  <option value="team">team</option>
                  <option value="enterprise">enterprise</option>
                </select>
              </label>
              <label className="block text-xs font-medium">
                Region
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </label>
              <Button type="button" disabled={busy || !name.trim()} onClick={() => create()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Create tenant
              </Button>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <Building2 className="size-4 text-sky-600" />
              <CardTitle className="text-base">Workspaces ({tenants.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Plan</th>
                      <th className="py-2 pr-3">Region</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-3 font-medium">{t.name}</td>
                        <td className="py-2 pr-3 capitalize">{t.plan}</td>
                        <td className="py-2 pr-3 text-xs">{t.region}</td>
                        <td className="py-2 text-xs">{t.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </AuthGate>
  );
}
