"use client";

import { useState } from "react";
import { Server, Plus, Trash2, ExternalLink, CheckCircle2, XCircle, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDeploymentStore } from "@/store/deployment-store";
import type { Environment } from "@/types";

const statusConfig: Record<Environment["status"], { icon: typeof CheckCircle2; color: string }> = {
  active: { icon: CheckCircle2, color: "text-emerald-600" },
  inactive: { icon: XCircle, color: "text-slate-400" },
  maintenance: { icon: Wrench, color: "text-amber-600" },
};

const typeColors: Record<Environment["type"], string> = {
  development: "bg-sky-100 text-sky-700",
  staging: "bg-amber-100 text-amber-700",
  production: "bg-emerald-100 text-emerald-700",
  qa: "bg-violet-100 text-violet-700",
};

export function EnvironmentManager() {
  const [isCreating, setIsCreating] = useState(false);
  const environments = useDeploymentStore((state) => state.environments);
  const addEnvironment = useDeploymentStore((state) => state.addEnvironment);
  const deleteEnvironment = useDeploymentStore((state) => state.deleteEnvironment);

  return (
    <section aria-labelledby="environments-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="environments-heading" className="text-base flex items-center gap-2">
            <Server className="size-4" />
            Environments
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            Add Environment
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <EnvironmentForm
              onSubmit={(env) => {
                addEnvironment(env);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          <div className="space-y-2">
            {environments.map((env) => {
              const config = statusConfig[env.status];
              const Icon = config.icon;

              return (
                <div key={env.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={`size-5 ${config.color}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{env.name}</p>
                          <Badge className={typeColors[env.type]}>{env.type}</Badge>
                          <Badge variant="outline">{env.version}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {env.url} · Deployed by {env.deployedBy}
                        </p>
                        <p className="text-xs text-slate-500">
                          Last deployed: {new Date(env.lastDeployed).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => window.open(env.url)}>
                        <ExternalLink className="size-4 text-slate-400" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => deleteEnvironment(env.id)}>
                        <Trash2 className="size-4 text-slate-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function EnvironmentForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (env: Omit<Environment, "id">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Environment["type"]>("development");
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      type,
      url: url.trim() || "https://localhost:3000",
      status: "active",
      version: "v1.0.0",
      lastDeployed: new Date().toISOString(),
      deployedBy: "Current User",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Production" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as Environment["type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="qa">QA</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Add</Button>
      </div>
    </form>
  );
}
