"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";

type ScimUser = {
  id: string;
  userName: string;
  displayName?: string;
  active: boolean;
  emails?: Array<{ value: string; primary?: boolean }>;
};

export default function SCIMPage() {
  const [users, setUsers] = useState<ScimUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(async () => {
    if (!isGoBackendEnabled()) {
      setUsers([
        {
          id: "demo",
          userName: "scim.admin",
          displayName: "SCIM Admin",
          active: true,
          emails: [{ value: "scim.admin@speedrunner.local", primary: true }],
        },
      ]);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await apiClient.scimListUsers();
      setUsers((res.Resources as ScimUser[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "SCIM list failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function createUser() {
    if (!userName.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (!isGoBackendEnabled()) {
        setUsers((u) => [
          ...u,
          {
            id: `local-${Date.now()}`,
            userName,
            displayName: displayName || userName,
            active: true,
            emails: email ? [{ value: email, primary: true }] : [],
          },
        ]);
        return;
      }
      await apiClient.scimCreateUser({
        userName,
        displayName: displayName || userName,
        active: true,
        emails: email ? [{ value: email, type: "work", primary: true }] : [],
      });
      setUserName("");
      setEmail("");
      setDisplayName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: ScimUser) {
    if (!isGoBackendEnabled()) return;
    setBusy(true);
    try {
      await apiClient.scimPatchUser(u.id, {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "replace", path: "active", value: !u.active }],
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Patch failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate>
      <AppShell subtitle="Directory provisioning" title="SCIM 2.0 users">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          RFC 7644-style Users API at{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">
            /api/scim/v2/Users
          </code>
          . Authenticate with admin JWT or{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">
            SCIM_TOKEN
          </code>
          .
        </p>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <UserPlus className="size-4 text-sky-600" />
              <CardTitle className="text-base">Provision user</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-xs font-medium">
                userName
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium">
                displayName
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium">
                email
                <input
                  type="email"
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <Button type="button" disabled={busy || !userName.trim()} onClick={() => createUser()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Create SCIM user
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-sky-600" />
                <CardTitle className="text-base">Directory ({users.length})</CardTitle>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => load()}>
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Active</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{u.displayName || u.userName}</div>
                          <div className="text-xs text-slate-500">{u.userName}</div>
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {u.emails?.[0]?.value || "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={
                              u.active
                                ? "rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700"
                                : "rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                            }
                          >
                            {u.active ? "active" : "inactive"}
                          </span>
                        </td>
                        <td className="py-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={busy || !isGoBackendEnabled()}
                            onClick={() => toggleActive(u)}
                          >
                            {u.active ? "Deactivate" : "Activate"}
                          </Button>
                        </td>
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
