"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ShoppingBag } from "lucide-react";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";

type Item = {
  id: string;
  name: string;
  kind: string;
  author: string;
  version: string;
  downloads: number;
  rating: number;
  description: string;
  tags?: string[];
};

export default function MarketplacePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [kind, setKind] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!isGoBackendEnabled()) {
      setItems([
        {
          id: "m-login",
          name: "Login Flow HTTP",
          kind: "script",
          author: "SpeedRunner",
          version: "1.2.0",
          downloads: 1200,
          rating: 4.6,
          description: "Parameterized login scenario",
          tags: ["http", "auth"],
        },
      ]);
      return;
    }
    try {
      const list = await apiClient.getMarketplace(kind ? { kind } : undefined);
      setItems(list as Item[]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Load failed");
    }
  }, [kind]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function install(id: string) {
    if (!isGoBackendEnabled()) {
      setMsg(`Installed ${id} (demo)`);
      return;
    }
    try {
      const it = await apiClient.marketplaceAction({ action: "install", id });
      setMsg(`Installed ${(it as { name?: string }).name || id}`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Install failed");
    }
  }

  return (
    <AuthGate>
      <AppShell subtitle="Asset catalog" title="Marketplace">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-slate-600 dark:text-slate-400">
            Browse and install scripts, templates, plugins, and connectors.
          </p>
          <select
            className="rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="Filter by kind"
          >
            <option value="">All kinds</option>
            <option value="script">script</option>
            <option value="template">template</option>
            <option value="plugin">plugin</option>
            <option value="connector">connector</option>
          </select>
          <Button type="button" size="sm" variant="outline" onClick={() => load()}>
            Refresh
          </Button>
        </div>
        {msg && <p className="text-sm text-sky-700 dark:text-sky-300">{msg}</p>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => (
            <Card key={it.id}>
              <CardHeader className="space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
                  <ShoppingBag className="size-3.5" />
                  {it.kind}
                </div>
                <CardTitle className="text-base">{it.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-slate-600 dark:text-slate-400">{it.description}</p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>v{it.version}</span>
                  <span>·</span>
                  <span>{it.author}</span>
                  <span>·</span>
                  <span>★ {it.rating}</span>
                  <span>·</span>
                  <span>{it.downloads} installs</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(it.tags || []).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <Button type="button" size="sm" onClick={() => install(it.id)}>
                  <Download className="size-3.5" /> Install
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </AppShell>
    </AuthGate>
  );
}
