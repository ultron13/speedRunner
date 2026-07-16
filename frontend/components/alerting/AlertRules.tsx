"use client";

import { useState } from "react";
import { Bell, Plus, Trash2, Play, Pause, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAlertingStore } from "@/store/alerting-store";

const severityColors: Record<string, string> = {
  info: "bg-sky-100 text-sky-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-rose-100 text-rose-700",
};

export function AlertRules() {
  const [isCreating, setIsCreating] = useState(false);
  const rules = useAlertingStore((state) => state.rules);
  const history = useAlertingStore((state) => state.history);
  const createRule = useAlertingStore((state) => state.createRule);
  const deleteRule = useAlertingStore((state) => state.deleteRule);
  const toggleRule = useAlertingStore((state) => state.toggleRule);
  const acknowledgeAlert = useAlertingStore((state) => state.acknowledgeAlert);

  return (
    <section aria-labelledby="alert-rules-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="alert-rules-heading" className="text-base flex items-center gap-2">
            <Bell className="size-4" />
            Alert Rules
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Rule
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <RuleForm
              onSubmit={(rule) => {
                createRule(rule);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Badge className={severityColors[rule.severity]}>
                    {rule.severity}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{rule.name}</p>
                    <p className="text-xs text-slate-500">
                      {rule.metric} {rule.condition} {rule.threshold}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => toggleRule(rule.id)}>
                    {rule.enabled ? (
                      <Pause className="size-4 text-amber-600" />
                    ) : (
                      <Play className="size-4 text-emerald-600" />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => deleteRule(rule.id)}>
                    <Trash2 className="size-4 text-slate-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Alert History */}
          {history.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="mb-2 text-sm font-medium">Recent Alerts</h4>
              <div className="space-y-1">
                {history.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
                    <span>{alert.message}</span>
                    {!alert.acknowledged && (
                      <Button variant="ghost" size="sm" onClick={() => acknowledgeAlert(alert.id)}>
                        <CheckCircle2 className="size-3" />
                      </Button>
                    )}
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

function RuleForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (rule: Omit<import("@/types").AlertRule, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [metric, setMetric] = useState("avgResponseTime");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState("500");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">("warning");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      metric,
      condition,
      threshold: parseFloat(threshold) || 500,
      severity,
      channels: [{ type: "email", target: "admin@example.com", enabled: true }],
      enabled: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label>Rule Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., High Response Time" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="grid gap-2">
          <Label>Metric</Label>
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="avgResponseTime">Response Time</SelectItem>
              <SelectItem value="errorRate">Error Rate</SelectItem>
              <SelectItem value="throughput">Throughput</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Condition</Label>
          <Select value={condition} onValueChange={(v) => setCondition(v as "above" | "below")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="above">Above</SelectItem>
              <SelectItem value="below">Below</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Threshold</Label>
          <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Severity</Label>
        <Select value={severity} onValueChange={(v) => setSeverity(v as "info" | "warning" | "critical")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
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
