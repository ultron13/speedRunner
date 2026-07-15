"use client";

import { useState } from "react";
import { GitBranch, Plus, Trash2, Play, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCICDStore } from "@/store/cicd-store";
import type { PipelineStageType } from "@/types";

const stageColors: Record<PipelineStageType, string> = {
  build: "bg-sky-100 text-sky-700",
  test: "bg-emerald-100 text-emerald-700",
  deploy: "bg-violet-100 text-violet-700",
  notify: "bg-amber-100 text-amber-700",
  approve: "bg-rose-100 text-rose-700",
};

export function CICDPipelines() {
  const [isCreating, setIsCreating] = useState(false);
  const pipelines = useCICDStore((state) => state.pipelines);
  const createPipeline = useCICDStore((state) => state.createPipeline);
  const deletePipeline = useCICDStore((state) => state.deletePipeline);
  const runPipeline = useCICDStore((state) => state.runPipeline);

  return (
    <section aria-labelledby="pipelines-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="pipelines-heading" className="text-base flex items-center gap-2">
            <GitBranch className="size-4" />
            CI/CD Pipelines
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
              <p className="text-sm">Create CI/CD pipelines for automated deployments.</p>
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
                    {pipeline.stages
                      .sort((a, b) => a.order - b.order)
                      .map((stage, index) => (
                        <div key={stage.id} className="flex items-center">
                          <Badge className={stageColors[stage.type]}>
                            {stage.name}
                          </Badge>
                          {index < pipeline.stages.length - 1 && (
                            <ChevronRight className="mx-1 size-3 text-slate-400" />
                          )}
                        </div>
                      ))}
                  </div>

                  {pipeline.lastRun && (
                    <p className="mt-2 text-xs text-slate-500">
                      Last run: {new Date(pipeline.lastRun).toLocaleString()}
                    </p>
                  )}
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
  onSubmit: (pipeline: Omit<import("@/types").CICDPipeline, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: "",
      stages: [
        { id: "s1", name: "Build", type: "build", config: {}, order: 1, enabled: true },
        { id: "s2", name: "Test", type: "test", config: {}, order: 2, enabled: true },
        { id: "s3", name: "Deploy", type: "deploy", config: {}, order: 3, enabled: true },
      ],
      trigger: "manual",
      enabled: true,
      lastRun: null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="pipeline-name">Pipeline Name</Label>
        <Input id="pipeline-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Production Deploy" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Create</Button>
      </div>
    </form>
  );
}
