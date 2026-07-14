"use client";

import { useState } from "react";
import { Calendar, Plus, Trash2, Play, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTestStore } from "@/store/test-store";
import type { ScheduleFrequency, TestSchedule } from "@/types";

const frequencyLabels: Record<ScheduleFrequency, string> = {
  once: "One-time",
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const frequencyIcons: Record<ScheduleFrequency, string> = {
  once: "1x",
  hourly: "H",
  daily: "D",
  weekly: "W",
  monthly: "M",
};

export function TestScheduler() {
  const [isCreating, setIsCreating] = useState(false);
  const tests = useTestStore((state) => state.tests);
  const schedules = useTestStore((state) => state.schedules);
  const createSchedule = useTestStore((state) => state.createSchedule);
  const updateSchedule = useTestStore((state) => state.updateSchedule);
  const deleteSchedule = useTestStore((state) => state.deleteSchedule);

  const idleTests = tests.filter((t) => t.status === "idle" || t.status === "completed");

  return (
    <section aria-labelledby="scheduler-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="scheduler-heading" className="text-base">Test Schedule</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreating(!isCreating)}
            disabled={idleTests.length === 0}
          >
            <Plus className="mr-1 size-4" />
            Schedule Test
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <ScheduleForm
              tests={idleTests}
              onSubmit={(schedule) => {
                createSchedule(schedule);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {schedules.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Calendar className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No scheduled tests</p>
              <p className="text-sm">Schedule tests to run automatically at specific times.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((schedule) => (
                <ScheduleRow
                  key={schedule.id}
                  schedule={schedule}
                  onToggle={(enabled) => updateSchedule(schedule.id, { enabled })}
                  onDelete={() => deleteSchedule(schedule.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ScheduleRow({
  schedule,
  onToggle,
  onDelete,
}: {
  schedule: TestSchedule;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold ${
          schedule.enabled
            ? "bg-sky-100 text-sky-700"
            : "bg-slate-100 text-slate-500"
        }`}>
          {frequencyIcons[schedule.frequency]}
        </div>
        <div>
          <p className="text-sm font-medium">{schedule.testName}</p>
          <p className="text-xs text-slate-500">
            {frequencyLabels[schedule.frequency]} · Next: {new Date(schedule.nextRunAt).toLocaleString("en", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onToggle(!schedule.enabled)}
          aria-label={schedule.enabled ? "Disable schedule" : "Enable schedule"}
        >
          {schedule.enabled ? (
            <Pause className="size-4 text-amber-600" />
          ) : (
            <Play className="size-4 text-emerald-600" />
          )}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete schedule">
          <Trash2 className="size-4 text-slate-400" />
        </Button>
      </div>
    </div>
  );
}

function ScheduleForm({
  tests,
  onSubmit,
  onCancel,
}: {
  tests: Array<{ id: string; name: string }>;
  onSubmit: (schedule: Omit<TestSchedule, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [testId, setTestId] = useState("");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [nextRunAt, setNextRunAt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testId || !nextRunAt) return;

    const test = tests.find((t) => t.id === testId);
    if (!test) return;

    onSubmit({
      testId,
      testName: test.name,
      frequency,
      nextRunAt: new Date(nextRunAt).toISOString(),
      lastRunAt: null,
      enabled: true,
      createdBy: "current-user",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label>Select Test</Label>
        <Select value={testId} onValueChange={setTestId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a test to schedule" />
          </SelectTrigger>
          <SelectContent>
            {tests.map((test) => (
              <SelectItem key={test.id} value={test.id}>
                {test.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Frequency</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as ScheduleFrequency)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="once">One-time</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="next-run">Next Run</Label>
          <Input
            id="next-run"
            type="datetime-local"
            value={nextRunAt}
            onChange={(e) => setNextRunAt(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Create Schedule
        </Button>
      </div>
    </form>
  );
}
