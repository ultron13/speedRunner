"use client";

import { useState } from "react";
import { Rocket, Plus, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCICDStore } from "@/store/cicd-store";
import type { Deployment } from "@/types";

const statusConfig: Record<Deployment["status"], { icon: typeof CheckCircle2; color: string }> = {
  pending: { icon: Clock, color: "text-slate-400" },
  in_progress: { icon: Clock, color: "text-amber-600" },
  completed: { icon: CheckCircle2, color: "text-emerald-600" },
  failed: { icon: XCircle, color: "text-rose-600" },
  rolled_back: { icon: AlertTriangle, color: "text-amber-600" },
};

const envColors: Record<Deployment["environment"], string> = {
  development: "bg-sky-100 text-sky-700",
  staging: "bg-amber-100 text-amber-700",
  production: "bg-emerald-100 text-emerald-700",
};

export function DeploymentTracking() {
  const [isCreating, setIsCreating] = useState(false);
  const deployments = useCICDStore((state) => state.deployments);
  const addDeployment = useCICDStore((state) => state.addDeployment);

  return (
    <section aria-labelledby="deployments-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="deployments-heading" className="text-base flex items-center gap-2">
            <Rocket className="size-4" />
            Deployments
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Deployment
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <DeploymentForm
              onSubmit={(deployment) => {
                addDeployment(deployment);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {deployments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Rocket className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No deployments</p>
              <p className="text-sm">Track your deployments here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {deployments.map((deployment) => {
                const config = statusConfig[deployment.status];
                const Icon = config.icon;

                return (
                  <div key={deployment.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className={`size-5 ${config.color}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{deployment.version}</p>
                            <Badge className={envColors[deployment.environment]}>
                              {deployment.environment}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {deployment.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">
                            Deployed by {deployment.deployedBy} · {new Date(deployment.startedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {deployment.changes.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500">Changes:</p>
                        <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                          {deployment.changes.map((change, index) => (
                            <li key={index}>{change}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {deployment.metrics && (
                      <div className="mt-2 flex gap-4 text-xs text-slate-500">
                        <span>Response: {deployment.metrics.responseTime}ms</span>
                        <span>Errors: {deployment.metrics.errorRate}%</span>
                        <span>Throughput: {deployment.metrics.throughput} req/s</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function DeploymentForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (deployment: Omit<import("@/types").Deployment, "id">) => void;
  onCancel: () => void;
}) {
  const [version, setVersion] = useState("");
  const [environment, setEnvironment] = useState<"development" | "staging" | "production">("staging");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!version.trim()) return;
    onSubmit({
      version: version.trim(),
      environment,
      status: "pending",
      startedAt: new Date().toISOString(),
      completedAt: null,
      deployedBy: "Current User",
      changes: [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="version">Version</Label>
        <Input id="version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g., v2.5.0" />
      </div>
      <div className="grid gap-2">
        <Label>Environment</Label>
        <Select value={environment} onValueChange={(v) => setEnvironment(v as typeof environment)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="production">Production</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Create</Button>
      </div>
    </form>
  );
}
