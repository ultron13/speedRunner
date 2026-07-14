"use client";

import { useState } from "react";
import { Copy, Plus, Trash2, BookTemplate } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTestStore } from "@/store/test-store";
import type { ScriptType, TestTemplate } from "@/types";

export function TestTemplates() {
  const [isCreating, setIsCreating] = useState(false);
  const templates = useTestStore((state) => state.templates);
  const saveTemplate = useTestStore((state) => state.saveTemplate);
  const deleteTemplate = useTestStore((state) => state.deleteTemplate);
  const createTestFromTemplate = useTestStore((state) => state.createTestFromTemplate);

  return (
    <section aria-labelledby="templates-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="templates-heading" className="text-base">Test Templates</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreating(!isCreating)}
          >
            <Plus className="mr-1 size-4" />
            Save Template
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <SaveTemplateForm
              onSave={(template) => {
                saveTemplate(template);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {templates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <BookTemplate className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No templates saved</p>
              <p className="text-sm">Save test configurations as templates for quick reuse.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  onUse={() => createTestFromTemplate(template.id)}
                  onDelete={() => deleteTemplate(template.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function TemplateRow({
  template,
  onUse,
  onDelete,
}: {
  template: TestTemplate;
  onUse: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{template.name}</p>
        <p className="truncate text-xs text-slate-500">
          {template.scriptType} · {template.virtualUsers.toLocaleString()} users · {template.targetUrl}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Used {template.usageCount} time{template.usageCount !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="ml-4 flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={onUse} aria-label="Use template" title="Create test from template">
          <Copy className="size-4 text-sky-600" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete template" title="Delete template">
          <Trash2 className="size-4 text-slate-400" />
        </Button>
      </div>
    </div>
  );
}

function SaveTemplateForm({
  onSave,
  onCancel,
}: {
  onSave: (template: Omit<TestTemplate, "id" | "createdAt" | "usageCount">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scriptType, setScriptType] = useState<ScriptType>("HTTP");
  const [targetUrl, setTargetUrl] = useState("");
  const [virtualUsers, setVirtualUsers] = useState("100");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetUrl.trim()) return;

    onSave({
      name: name.trim(),
      description: description.trim(),
      scriptType,
      targetUrl: targetUrl.trim(),
      virtualUsers: parseInt(virtualUsers, 10) || 100,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="template-name">Template Name</Label>
        <Input
          id="template-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., API Stress Test"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="template-desc">Description</Label>
        <Input
          id="template-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Script Type</Label>
          <Select value={scriptType} onValueChange={(v) => setScriptType(v as ScriptType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HTTP">HTTP</SelectItem>
              <SelectItem value="TruClient">TruClient</SelectItem>
              <SelectItem value="JMeter">JMeter</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="template-users">Virtual Users</Label>
          <Input
            id="template-users"
            type="number"
            value={virtualUsers}
            onChange={(e) => setVirtualUsers(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="template-url">Target URL</Label>
        <Input
          id="template-url"
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://api.example.com/v1/test"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Save Template
        </Button>
      </div>
    </form>
  );
}
