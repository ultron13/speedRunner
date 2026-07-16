"use client";

import { useState } from "react";
import { GitBranch, Plus, Trash2, Play, ChevronRight, CheckCircle2, Clock, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDeploymentStore } from "@/store/deployment-store";
import type { PipelineStage2 } from "@/types";

const stageStatusConfig: Record<PipelineStage2["status"], { icon: typeof CheckCircle2; color: string }> = {
  pending: { icon: Clock, color: "text-slate-400" },
  running: { icon: Clock, color: "text-amber-600" },
  completed: { icon: CheckCircle2, color: "text-emerald-600" },
  failed: { icon: XCircle, color: "text-rose-600" },
  skipped: { icon: Clock, color: "text-slate-400" },
};

const stageTypeColors: Record<string, string> = {
  build: "bg-sky-100 text-sky-700",
  test: "bg-emerald-100 text-emerald-700",
  deploy: "bg-violet-100 text-violet-700",
  approve: "bg-amber-100 text-amber-700",
  notify: "bg-rose-100 text-rose-700",
};

export function DeploymentPipelines() {
  const [isCreating, setIsCreating] = useState(false);
  const pipelines = useDeploymentStore((state) => state.pipelines);
  const createPipeline = useDeploymentStore((state) => state.createPipeline);
  const deletePipeline = useDeploymentStore((state) => state.deletePipeline);
  const runPipeline = useDeploymentStore((state) => state.runPipeline);

  return (
    <section aria-labelledby="pipelines-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="pipelines-heading" className="text-base flex items-center gap-2">
            <GitBranch className="size-4" />
            Deployment Pipelines
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Pipeline
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <PipelineForm
              onSubmit={(pipeline) => {
                createPipeline(pipeline);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {pipelines.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <GitBranch className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No pipelines</p>
              <p className="text-sm">Create deployment pipelines for automated deployments.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pipelines.map((pipeline) => (
                <div key={pipeline.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={pipeline.enabled ? "default" : "secondary"}>
                        {pipeline.trigger}
                      </Badge>
                      <p className="font-medium">{pipeline.name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => runPipeline(pipeline.id)}
                        title="Run pipeline"
                      >
                        <Play className="size-4 text-emerald-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deletePipeline(pipeline.id)}
                      >
                        <Trash2 className="size-4 text-slate-400" />
                      </Button>
                    </div>
                  </div>

                  {/* Pipeline Stages */}
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {pipeline.stages.map((stage, index) => {
                      const config = stageStatusConfig[stage.status];
                      const StageIcon = config.icon;

                      return (
                        <div key={stage.id} className="flex items-center">
                          <div className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${stageTypeColors[stage.type]}`}>
                            <StageIcon className={`size-3 ${config.color}`} />
                            {stage.name}
                          </div>
                          {index < pipeline.stages.length - 1 && (
                            <ChevronRight className="mx-1 size-3 text-slate-400" />
                          )}
                        </div>
                      );
                    })}
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

function PipelineForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (pipeline: Omit<import("@/types").DeploymentPipeline, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      environments: [],
      stages: [
        { id: "s1", name: "Build", type: "build", status: "pending" },
        { id: "s2", name: "Test", type: "test", status: "pending" },
        { id: "s3", name: "Deploy", type: "deploy", status: "pending" },
      ],
      trigger: "manual",
      enabled: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label>Pipeline Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Production Deploy" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Create</Button>
      </div>
    </form>
  );
}
