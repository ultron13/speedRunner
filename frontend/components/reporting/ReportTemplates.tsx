"use client";

import { useState } from "react";
import { Plus, Trash2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useReportingStore } from "@/store/reporting-store";
import type { ReportTemplateType } from "@/types";

const typeLabels: Record<ReportTemplateType, string> = {
  executive: "Executive",
  technical: "Technical",
  comparison: "Comparison",
  trend: "Trend",
  custom: "Custom",
};

const typeColors: Record<ReportTemplateType, string> = {
  executive: "bg-sky-100 text-sky-700",
  technical: "bg-violet-100 text-violet-700",
  comparison: "bg-emerald-100 text-emerald-700",
  trend: "bg-amber-100 text-amber-700",
  custom: "bg-slate-100 text-slate-700",
};

export function ReportTemplates() {
  const [isCreating, setIsCreating] = useState(false);
  const templates = useReportingStore((state) => state.templates);
  const createTemplate = useReportingStore((state) => state.createTemplate);
  const deleteTemplate = useReportingStore((state) => state.deleteTemplate);
  const applyTemplate = useReportingStore((state) => state.applyTemplate);

  return (
    <section aria-labelledby="templates-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="templates-heading" className="text-base">Report Templates</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Template
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <TemplateForm
              onSubmit={(template) => {
                createTemplate(template);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          <div className="space-y-2">
            {templates.map((template) => (
              <div key={template.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Badge className={typeColors[template.type]}>{typeLabels[template.type]}</Badge>
                  <div>
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs text-slate-500">
                      {template.sections.length} sections · Used {template.usageCount} times
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => applyTemplate(template.id)}
                    title="Use template"
                  >
                    <Play className="size-4 text-emerald-600" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => deleteTemplate(template.id)}>
                    <Trash2 className="size-4 text-slate-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function TemplateForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (template: Omit<import("@/types").ReportTemplate, "id" | "createdAt" | "usageCount">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ReportTemplateType>("executive");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: "",
      type,
      sections: [
        { id: "s1", title: "Summary", type: "metrics", config: {} },
        { id: "s2", title: "Details", type: "table", config: {} },
      ],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="template-name">Template Name</Label>
        <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Weekly Performance Report" />
      </div>
      <div className="grid gap-2">
        <Label>Template Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as ReportTemplateType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(typeLabels).map(([key, label]) => (
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
