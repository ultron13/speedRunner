"use client";

import { useState } from "react";
import { Zap, Plus, Trash2, Play, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAdvancedTestStore } from "@/store/advanced-test-store";
import type { ChaosScenarioType } from "@/types";

const typeLabels: Record<ChaosScenarioType, string> = {
  network: "Network Failure",
  latency: "High Latency",
  error: "Error Injection",
  timeout: "Timeout",
  resource: "Resource Limit",
};

const typeColors: Record<ChaosScenarioType, string> = {
  network: "bg-rose-100 text-rose-700",
  latency: "bg-amber-100 text-amber-700",
  error: "bg-orange-100 text-orange-700",
  timeout: "bg-sky-100 text-sky-700",
  resource: "bg-violet-100 text-violet-700",
};

export function ChaosScenarios() {
  const [isCreating, setIsCreating] = useState(false);
  const scenarios = useAdvancedTestStore((state) => state.chaosScenarios);
  const createScenario = useAdvancedTestStore((state) => state.createChaosScenario);
  const deleteScenario = useAdvancedTestStore((state) => state.deleteChaosScenario);
  const toggleScenario = useAdvancedTestStore((state) => state.toggleChaosScenario);

  return (
    <section aria-labelledby="chaos-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="chaos-heading" className="text-base">Chaos Scenarios</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Scenario
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <ChaosForm
              onSubmit={(scenario) => {
                createScenario(scenario);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {scenarios.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Zap className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No chaos scenarios</p>
              <p className="text-sm">Define chaos engineering scenarios to test resilience.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scenarios.map((scenario) => (
                <div key={scenario.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Badge className={typeColors[scenario.type]}>{typeLabels[scenario.type]}</Badge>
                    <div>
                      <p className="text-sm font-medium">{scenario.name}</p>
                      <p className="text-xs text-slate-500">
                        Intensity: {scenario.config.intensity}% · Duration: {scenario.config.duration}s
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleScenario(scenario.id)}
                    >
                      {scenario.enabled ? (
                        <Pause className="size-4 text-amber-600" />
                      ) : (
                        <Play className="size-4 text-emerald-600" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => deleteScenario(scenario.id)}>
                      <Trash2 className="size-4 text-slate-400" />
                    </Button>
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

function ChaosForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (scenario: Omit<import("@/types").ChaosScenario, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ChaosScenarioType>("network");
  const [intensity, setIntensity] = useState("50");
  const [duration, setDuration] = useState("60");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      description: "",
      type,
      config: {
        target: "all",
        intensity: parseInt(intensity) || 50,
        duration: parseInt(duration) || 60,
        probability: 100,
      },
      enabled: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="chaos-name">Scenario Name</Label>
        <Input id="chaos-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Network Partition" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="grid gap-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as ChaosScenarioType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Intensity (%)</Label>
          <Input type="number" value={intensity} onChange={(e) => setIntensity(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Duration (s)</Label>
          <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Create</Button>
      </div>
    </form>
  );
}
