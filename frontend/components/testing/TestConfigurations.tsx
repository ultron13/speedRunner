"use client";

import { useState } from "react";
import { Settings, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAdvancedTestStore } from "@/store/advanced-test-store";
import type { ScriptType, TestConfiguration } from "@/types";

export function TestConfigurations() {
  const [isCreating, setIsCreating] = useState(false);
  const configurations = useAdvancedTestStore((state) => state.configurations);
  const createConfiguration = useAdvancedTestStore((state) => state.createConfiguration);
  const deleteConfiguration = useAdvancedTestStore((state) => state.deleteConfiguration);

  return (
    <section aria-labelledby="configs-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="configs-heading" className="text-base">Test Configurations</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Config
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <ConfigForm
              onSubmit={(config) => {
                createConfiguration(config);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {configurations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Settings className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No configurations</p>
              <p className="text-sm">Save test configurations for quick reuse.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {configurations.map((config) => (
                <ConfigRow
                  key={config.id}
                  config={config}
                  onDelete={() => deleteConfiguration(config.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ConfigRow({
  config,
  onDelete,
}: {
  config: TestConfiguration;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
          <Settings className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{config.name}</p>
          <p className="text-xs text-slate-500">
            {config.scriptType} · {config.virtualUsers} users · {config.duration}s
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="text-xs">
          {config.scriptType}
        </Badge>
        <Button variant="ghost" size="icon-sm" onClick={onDelete}>
          <Trash2 className="size-4 text-slate-400" />
        </Button>
      </div>
    </div>
  );
}

function ConfigForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (config: Omit<TestConfiguration, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [scriptType, setScriptType] = useState<ScriptType>("HTTP");
  const [virtualUsers, setVirtualUsers] = useState("100");
  const [duration, setDuration] = useState("300");
  const [targetUrl, setTargetUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      description: "",
      targetUrl: targetUrl.trim() || "https://api.example.com",
      scriptType,
      virtualUsers: parseInt(virtualUsers) || 100,
      duration: parseInt(duration) || 300,
      rampUpTime: 0,
      thinkTime: 1,
      headers: {},
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="config-name">Configuration Name</Label>
        <Input
          id="config-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., API Stress Test"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Script Type</Label>
          <Select value={scriptType} onValueChange={(v) => setScriptType(v as ScriptType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="HTTP">HTTP</SelectItem>
              <SelectItem value="TruClient">TruClient</SelectItem>
              <SelectItem value="JMeter">JMeter</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Virtual Users</Label>
          <Input type="number" value={virtualUsers} onChange={(e) => setVirtualUsers(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Duration (seconds)</Label>
          <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Target URL</Label>
          <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://api.example.com" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Save</Button>
      </div>
    </form>
  );
}
