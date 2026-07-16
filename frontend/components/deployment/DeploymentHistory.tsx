"use client";

import { useState } from "react";
import { History, RotateCcw, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDeploymentStore } from "@/store/deployment-store";
import type { DeploymentRecord } from "@/types";

const statusConfig: Record<DeploymentRecord["status"], { icon: typeof CheckCircle2; color: string }> = {
  pending: { icon: Clock, color: "text-slate-400" },
  in_progress: { icon: Clock, color: "text-amber-600" },
  completed: { icon: CheckCircle2, color: "text-emerald-600" },
  failed: { icon: XCircle, color: "text-rose-600" },
  rolled_back: { icon: AlertTriangle, color: "text-amber-600" },
};

export function DeploymentHistory() {
  const [showRollback, setShowRollback] = useState<string | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");
  const deployments = useDeploymentStore((state) => state.deployments);
  const rollbackDeployment = useDeploymentStore((state) => state.rollbackDeployment);

  const handleRollback = (deploymentId: string) => {
    const deployment = deployments.find((d) => d.id === deploymentId);
    if (!deployment) return;

    rollbackDeployment(deploymentId, deployment.version, rollbackReason || "Manual rollback");
    setShowRollback(null);
    setRollbackReason("");
  };

  return (
    <section aria-labelledby="deployment-history-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle id="deployment-history-heading" className="text-base flex items-center gap-2">
            <History className="size-4" />
            Deployment History
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {deployments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <History className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No deployments yet</p>
              <p className="text-sm">Deployment history will appear here.</p>
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
                            <Badge variant="outline">{deployment.environment}</Badge>
                            <Badge variant="outline" className="capitalize">
                              {deployment.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">
                            {deployment.deployedBy} · {new Date(deployment.startedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {deployment.status === "completed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowRollback(deployment.id)}
                        >
                          <RotateCcw className="mr-1 size-4" />
                          Rollback
                        </Button>
                      )}
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
                        <span>Availability: {deployment.metrics.availability}%</span>
                      </div>
                    )}

                    {/* Rollback Form */}
                    {showRollback === deployment.id && (
                      <div className="mt-3 rounded-lg border border-dashed p-3">
                        <p className="mb-2 text-sm font-medium">Rollback to previous version</p>
                        <Input
                          value={rollbackReason}
                          onChange={(e) => setRollbackReason(e.target.value)}
                          placeholder="Reason for rollback"
                          className="mb-2"
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowRollback(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleRollback(deployment.id)}>
                            Confirm Rollback
                          </Button>
                        </div>
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
