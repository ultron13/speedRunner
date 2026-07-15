"use client";

import { useState } from "react";
import { Calendar, Plus, Trash2, Play, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useReportingStore } from "@/store/reporting-store";

export function ScheduledReports() {
  const [isCreating, setIsCreating] = useState(false);
  const scheduledReports = useReportingStore((state) => state.scheduledReports);
  const templates = useReportingStore((state) => state.templates);
  const createScheduledReport = useReportingStore((state) => state.createScheduledReport);
  const deleteScheduledReport = useReportingStore((state) => state.deleteScheduledReport);
  const toggleScheduledReport = useReportingStore((state) => state.toggleScheduledReport);

  return (
    <section aria-labelledby="scheduled-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="scheduled-heading" className="text-base">Scheduled Reports</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Schedule
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <ScheduleForm
              templates={templates}
              onSubmit={(report) => {
                createScheduledReport(report);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {scheduledReports.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Calendar className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No scheduled reports</p>
              <p className="text-sm">Schedule reports to be generated automatically.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scheduledReports.map((report) => (
                <div key={report.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={report.enabled ? "default" : "secondary"}>
                      {report.frequency}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{report.name}</p>
                      <p className="text-xs text-slate-500">
                        Recipients: {report.recipients.length} · Next: {new Date(report.nextGeneration).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleScheduledReport(report.id)}
                    >
                      {report.enabled ? (
                        <Pause className="size-4 text-amber-600" />
                      ) : (
                        <Play className="size-4 text-emerald-600" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => deleteScheduledReport(report.id)}>
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
  templates,
  onSubmit,
  onCancel,
}: {
  templates: Array<{ id: string; name: string }>;
  onSubmit: (report: Omit<import("@/types").ScheduledReport, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id || "");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [recipients, setRecipients] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const nextDate = new Date();
    if (frequency === "daily") nextDate.setDate(nextDate.getDate() + 1);
    else if (frequency === "weekly") nextDate.setDate(nextDate.getDate() + 7);
    else nextDate.setMonth(nextDate.getMonth() + 1);

    onSubmit({
      name: name.trim(),
      templateId,
      frequency,
      recipients: recipients.split(",").map((r) => r.trim()).filter(Boolean),
      lastGenerated: null,
      nextGeneration: nextDate.toISOString(),
      enabled: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="sched-name">Schedule Name</Label>
        <Input id="sched-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Weekly Performance Report" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
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
        <Label htmlFor="recipients">Recipients (comma-separated)</Label>
        <Input id="recipients" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="team@example.com, manager@example.com" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Create</Button>
      </div>
    </form>
  );
}
