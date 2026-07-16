"use client";

import { useState } from "react";
import { Calendar, Plus, Trash2, Play, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDataUtilitiesStore } from "@/store/data-utilities-store";

export function ScheduledExports() {
  const [isCreating, setIsCreating] = useState(false);
  const scheduledExports = useDataUtilitiesStore((state) => state.scheduledExports);
  const exports = useDataUtilitiesStore((state) => state.exports);
  const createScheduledExport = useDataUtilitiesStore((state) => state.createScheduledExport);
  const deleteScheduledExport = useDataUtilitiesStore((state) => state.deleteScheduledExport);
  const toggleScheduledExport = useDataUtilitiesStore((state) => state.toggleScheduledExport);

  return (
    <section aria-labelledby="scheduled-exports-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="scheduled-exports-heading" className="text-base">Scheduled Exports</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Schedule
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <ScheduleForm
              exports={exports}
              onSubmit={(config) => {
                createScheduledExport(config);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {scheduledExports.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Calendar className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No scheduled exports</p>
              <p className="text-sm">Schedule exports to run automatically.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scheduledExports.map((sched) => (
                <div key={sched.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={sched.enabled ? "default" : "secondary"}>
                      {sched.frequency}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{sched.name}</p>
                      <p className="text-xs text-slate-500">
                        Destination: {sched.destination} · Next: {new Date(sched.nextExport).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleScheduledExport(sched.id)}
                    >
                      {sched.enabled ? (
                        <Pause className="size-4 text-amber-600" />
                      ) : (
                        <Play className="size-4 text-emerald-600" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => deleteScheduledExport(sched.id)}>
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

function ScheduleForm({
  exports,
  onSubmit,
  onCancel,
}: {
  exports: Array<{ id: string; name: string }>;
  onSubmit: (config: Omit<import("@/types").ScheduledExport, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [exportConfigId, setExportConfigId] = useState(exports[0]?.id || "");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [destination, setDestination] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const nextDate = new Date();
    if (frequency === "daily") nextDate.setDate(nextDate.getDate() + 1);
    else if (frequency === "weekly") nextDate.setDate(nextDate.getDate() + 7);
    else nextDate.setMonth(nextDate.getMonth() + 1);

    onSubmit({
      name: name.trim(),
      exportConfigId,
      frequency,
      destination: destination.trim() || "local",
      lastExported: null,
      nextExport: nextDate.toISOString(),
      enabled: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="sched-name">Schedule Name</Label>
        <Input id="sched-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Weekly Data Export" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Export Config</Label>
          <Select value={exportConfigId} onValueChange={setExportConfigId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {exports.map((exp) => (
                <SelectItem key={exp.id} value={exp.id}>{exp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Frequency</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="destination">Destination</Label>
        <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g., /exports or s3://bucket" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Create</Button>
      </div>
    </form>
  );
}
