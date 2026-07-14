"use client";

import { useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTestStore } from "@/store/test-store";
import type { SLAThreshold } from "@/types";

export function SLAConfig() {
  const [isAdding, setIsAdding] = useState(false);
  const thresholds = useTestStore((state) => state.slaThresholds);
  const violations = useTestStore((state) => state.slaViolations);
  const addThreshold = useTestStore((state) => state.addSLAThreshold);
  const updateThreshold = useTestStore((state) => state.updateSLAThreshold);
  const removeThreshold = useTestStore((state) => state.removeSLAThreshold);

  const recentViolations = violations.slice(0, 5);

  return (
    <section aria-labelledby="sla-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="sla-heading" className="text-base">SLA Thresholds</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
          >
            <Plus className="mr-1 size-4" />
            Add Rule
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isAdding && (
            <AddThresholdForm
              onAdd={(threshold) => {
                addThreshold(threshold);
                setIsAdding(false);
              }}
              onCancel={() => setIsAdding(false)}
            />
          )}

          <div className="space-y-2">
            {thresholds.map((threshold) => (
              <ThresholdRow
                key={threshold.id}
                threshold={threshold}
                onToggle={(enabled) => updateThreshold(threshold.id, { enabled })}
                onRemove={() => removeThreshold(threshold.id)}
              />
            ))}
          </div>

          {recentViolations.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-700">
                <AlertTriangle className="size-4" />
                Recent Violations
              </h4>
              <div className="space-y-1">
                {recentViolations.map((violation, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded bg-amber-50 px-3 py-1.5 text-xs dark:bg-amber-950"
                  >
                    <span className="text-amber-800 dark:text-amber-200">
                      {violation.metric}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400">
                      Expected {violation.expected}, got {violation.actual}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ThresholdRow({
  threshold,
  onToggle,
  onRemove,
}: {
  threshold: SLAThreshold;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}) {
  const metricLabels: Record<string, string> = {
    avgResponseTime: "Avg Response Time",
    errorRate: "Error Rate",
    throughput: "Throughput",
  };

  const unit =
    threshold.metric === "avgResponseTime"
      ? "ms"
      : threshold.metric === "errorRate"
        ? "%"
        : "req/s";

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onToggle(!threshold.enabled)}
          className={`size-3 rounded-full ${
            threshold.enabled
              ? "bg-emerald-500"
              : "bg-slate-300 dark:bg-slate-600"
          }`}
          aria-label={threshold.enabled ? "Disable threshold" : "Enable threshold"}
        />
        <div>
          <p className="text-sm font-medium">{threshold.name}</p>
          <p className="text-xs text-slate-500">
            {metricLabels[threshold.metric]} {threshold.condition === "lessThan" ? "<" : ">"} {threshold.value}{unit}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label="Remove threshold"
      >
        <Trash2 className="size-4 text-slate-400" />
      </Button>
    </div>
  );
}

function AddThresholdForm({
  onAdd,
  onCancel,
}: {
  onAdd: (threshold: Omit<SLAThreshold, "id">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [metric, setMetric] = useState<SLAThreshold["metric"]>("avgResponseTime");
  const [condition, setCondition] = useState<SLAThreshold["condition"]>("lessThan");
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !value) return;

    onAdd({
      name: name.trim(),
      metric,
      condition,
      value: parseFloat(value),
      enabled: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="threshold-name">Name</Label>
        <Input
          id="threshold-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Response Time SLA"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="grid gap-2">
          <Label>Metric</Label>
          <Select value={metric} onValueChange={(v) => setMetric(v as SLAThreshold["metric"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="avgResponseTime">Response Time</SelectItem>
              <SelectItem value="errorRate">Error Rate</SelectItem>
              <SelectItem value="throughput">Throughput</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Condition</Label>
          <Select value={condition} onValueChange={(v) => setCondition(v as SLAThreshold["condition"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lessThan">Less than</SelectItem>
              <SelectItem value="greaterThan">Greater than</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="threshold-value">Value</Label>
          <Input
            id="threshold-value"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="500"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Add Rule
        </Button>
      </div>
    </form>
  );
}
