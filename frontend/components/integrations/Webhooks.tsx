"use client";

import { useState } from "react";
import { Webhook, Plus, Trash2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useIntegrationStore } from "@/store/integration-store";
import type { Webhook as WebhookType, WebhookEvent } from "@/types";

const eventLabels: Record<WebhookEvent, string> = {
  "test.created": "Test Created",
  "test.started": "Test Started",
  "test.completed": "Test Completed",
  "test.failed": "Test Failed",
  "test.stopped": "Test Stopped",
  "test.deleted": "Test Deleted",
  "sla.violation": "SLA Violation",
  "schedule.triggered": "Schedule Triggered",
};

export function Webhooks() {
  const [isCreating, setIsCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const webhooks = useIntegrationStore((state) => state.webhooks);
  const createWebhook = useIntegrationStore((state) => state.createWebhook);
  const deleteWebhook = useIntegrationStore((state) => state.deleteWebhook);
  const testWebhook = useIntegrationStore((state) => state.testWebhook);
  const toggleWebhook = useIntegrationStore((state) => state.updateWebhook);

  const handleTest = async (id: string) => {
    setTestingId(id);
    await testWebhook(id);
    setTestingId(null);
  };

  return (
    <section aria-labelledby="webhooks-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="webhooks-heading" className="text-base">Webhooks</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            Add Webhook
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <CreateWebhookForm
              onSubmit={(name, url, events) => {
                createWebhook(name, url, events);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {webhooks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Webhook className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No webhooks configured</p>
              <p className="text-sm">Add webhooks to receive notifications on test events.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {webhooks.map((webhook) => (
                <WebhookRow
                  key={webhook.id}
                  webhook={webhook}
                  isTesting={testingId === webhook.id}
                  onTest={() => handleTest(webhook.id)}
                  onToggle={(enabled) => toggleWebhook(webhook.id, { enabled })}
                  onDelete={() => deleteWebhook(webhook.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function WebhookRow({
  webhook,
  isTesting,
  onTest,
  onToggle,
  onDelete,
}: {
  webhook: WebhookType;
  isTesting: boolean;
  onTest: () => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`size-2 rounded-full ${webhook.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
          <div>
            <p className="text-sm font-medium">{webhook.name}</p>
            <p className="max-w-xs truncate text-xs text-slate-500">{webhook.url}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onTest}
            disabled={isTesting}
            title="Test webhook"
          >
            {isTesting ? (
              <div className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
            ) : (
              <Play className="size-4 text-slate-400" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggle(!webhook.enabled)}
            title={webhook.enabled ? "Disable" : "Enable"}
          >
            <div className={`size-3 rounded-full ${webhook.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Delete">
            <Trash2 className="size-4 text-rose-400" />
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {webhook.events.map((event) => (
          <Badge key={event} variant="secondary" className="text-xs">
            {eventLabels[event]}
          </Badge>
        ))}
      </div>
      {webhook.lastTriggeredAt && (
        <p className="mt-2 text-xs text-slate-500">
          Last triggered: {new Date(webhook.lastTriggeredAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function CreateWebhookForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string, url: string, events: WebhookEvent[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>(["test.completed", "test.failed"]);

  const toggleEvent = (event: WebhookEvent) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim() || selectedEvents.length === 0) return;
    onSubmit(name.trim(), url.trim(), selectedEvents);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="webhook-name">Name</Label>
        <Input
          id="webhook-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Slack Notifications"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="webhook-url">Endpoint URL</Label>
        <Input
          id="webhook-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
        />
      </div>
      <div className="grid gap-2">
        <Label>Events</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(eventLabels) as WebhookEvent[]).map((event) => (
            <button
              key={event}
              type="button"
              onClick={() => toggleEvent(event)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                selectedEvents.includes(event)
                  ? "bg-sky-100 text-sky-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {eventLabels[event]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Create Webhook
        </Button>
      </div>
    </form>
  );
}
