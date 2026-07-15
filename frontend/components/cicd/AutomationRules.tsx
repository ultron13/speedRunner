"use client";

import { useState } from "react";
import { Zap, Plus, Trash2, Play, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCICDStore } from "@/store/cicd-store";
import type { AutomationTrigger } from "@/types";

const triggerLabels: Record<AutomationTrigger, string> = {
  test_completed: "Test Completed",
  deployment: "Deployment",
  schedule: "Schedule",
  manual: "Manual",
  webhook: "Webhook",
};

const triggerColors: Record<AutomationTrigger, string> = {
  test_completed: "bg-emerald-100 text-emerald-700",
  deployment: "bg-sky-100 text-sky-700",
  schedule: "bg-amber-100 text-amber-700",
  manual: "bg-slate-100 text-slate-700",
  webhook: "bg-violet-100 text-violet-700",
};

export function AutomationRules() {
  const [isCreating, setIsCreating] = useState(false);
  const rules = useCICDStore((state) => state.automationRules);
  const createRule = useCICDStore((state) => state.createAutomationRule);
  const deleteRule = useCICDStore((state) => state.deleteAutomationRule);
  const toggleRule = useCICDStore((state) => state.toggleAutomationRule);

  return (
    <section aria-labelledby="automation-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="automation-heading" className="text-base flex items-center gap-2">
            <Zap className="size-4" />
            Automation Rules
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

          {rules.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Zap className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No automation rules</p>
              <p className="text-sm">Create rules to automate test execution.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Badge className={triggerColors[rule.trigger]}>
                      {triggerLabels[rule.trigger]}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{rule.name}</p>
                      <p className="text-xs text-slate-500">
                        {rule.actions.length} action(s) · {rule.conditions.length} condition(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleRule(rule.id)}
                    >
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
  onSubmit: (rule: Omit<import("@/types").AutomationRule, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger>("test_completed");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: "",
      trigger,
      conditions: [],
      actions: [{ type: "send_notification", config: {} }],
      enabled: true,
      lastTriggered: null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="rule-name">Rule Name</Label>
        <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Auto-run on deploy" />
      </div>
      <div className="grid gap-2">
        <Label>Trigger</Label>
        <Select value={trigger} onValueChange={(v) => setTrigger(v as AutomationTrigger)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(triggerLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
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
