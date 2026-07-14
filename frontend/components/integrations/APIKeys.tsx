"use client";

import { useState } from "react";
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIntegrationStore } from "@/store/integration-store";
import type { Permission } from "@/types";

export function APIKeys() {
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<string | null>(null);
  const apiKeys = useIntegrationStore((state) => state.apiKeys);
  const generateAPIKey = useIntegrationStore((state) => state.generateAPIKey);
  const revokeAPIKey = useIntegrationStore((state) => state.revokeAPIKey);
  const toggleAPIKey = useIntegrationStore((state) => state.toggleAPIKey);

  const handleCopy = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section aria-labelledby="api-keys-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="api-keys-heading" className="text-base">API Keys</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            Generate Key
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <CreateKeyForm
              onSubmit={(name, permissions) => {
                generateAPIKey(name, permissions);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {apiKeys.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Key className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No API keys</p>
              <p className="text-sm">Generate an API key to access the SpeedRunner API.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-2 rounded-full ${apiKey.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                      <div>
                        <p className="text-sm font-medium">{apiKey.name}</p>
                        <p className="font-mono text-xs text-slate-500">{apiKey.prefix}...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleCopy(apiKey.key, apiKey.id)}
                        title="Copy key"
                      >
                        {copiedId === apiKey.id ? (
                          <Check className="size-4 text-emerald-600" />
                        ) : (
                          <Copy className="size-4 text-slate-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setShowKey(showKey === apiKey.id ? null : apiKey.id)}
                        title={showKey === apiKey.id ? "Hide key" : "Show key"}
                      >
                        {showKey === apiKey.id ? (
                          <EyeOff className="size-4 text-slate-400" />
                        ) : (
                          <Eye className="size-4 text-slate-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleAPIKey(apiKey.id)}
                        title={apiKey.enabled ? "Disable" : "Enable"}
                      >
                        <div className={`size-3 rounded-full ${apiKey.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => revokeAPIKey(apiKey.id)}
                        title="Revoke"
                      >
                        <Trash2 className="size-4 text-rose-400" />
                      </Button>
                    </div>
                  </div>
                  {showKey === apiKey.id && (
                    <div className="mt-2 rounded bg-slate-50 p-2 font-mono text-xs dark:bg-slate-800">
                      {apiKey.key}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2 text-xs text-slate-500">
                    <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                    {apiKey.lastUsedAt && (
                      <span>· Last used: {new Date(apiKey.lastUsedAt).toLocaleDateString()}</span>
                    )}
                    {apiKey.expiresAt && (
                      <span>· Expires: {new Date(apiKey.expiresAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function CreateKeyForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string, permissions: Permission[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const permissions: Permission[] = [{ action: "read", resource: "tests" }];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), permissions);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="key-name">Key Name</Label>
        <Input
          id="key-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., CI/CD Pipeline"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Generate Key
        </Button>
      </div>
    </form>
  );
}
