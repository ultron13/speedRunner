"use client";

import { useState } from "react";
import { Download, Plus, Trash2, Play, FileText, FileSpreadsheet, Code } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDataUtilitiesStore } from "@/store/data-utilities-store";
import type { DataExportFormat } from "@/types";

const formatIcons: Record<DataExportFormat, typeof FileText> = {
  csv: FileSpreadsheet,
  json: Code,
  pdf: FileText,
  html: FileText,
  xml: Code,
};

const formatColors: Record<DataExportFormat, string> = {
  csv: "bg-emerald-100 text-emerald-700",
  json: "bg-sky-100 text-sky-700",
  pdf: "bg-rose-100 text-rose-700",
  html: "bg-amber-100 text-amber-700",
  xml: "bg-violet-100 text-violet-700",
};

export function DataExports() {
  const [isCreating, setIsCreating] = useState(false);
  const exports = useDataUtilitiesStore((state) => state.exports);
  const createExport = useDataUtilitiesStore((state) => state.createExport);
  const deleteExport = useDataUtilitiesStore((state) => state.deleteExport);
  const runExport = useDataUtilitiesStore((state) => state.runExport);

  return (
    <section aria-labelledby="exports-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="exports-heading" className="text-base">Data Exports</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Export
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <ExportForm
              onSubmit={(config) => {
                createExport(config);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {exports.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Download className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No export configurations</p>
              <p className="text-sm">Create export configurations for quick data export.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {exports.map((exp) => {
                const Icon = formatIcons[exp.format];
                return (
                  <div key={exp.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Badge className={formatColors[exp.format]}>
                        <Icon className="mr-1 size-3" />
                        {exp.format.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{exp.name}</p>
                        <p className="text-xs text-slate-500">Source: {exp.dataSource}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => runExport(exp.id)}>
                        <Play className="size-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => deleteExport(exp.id)}>
                        <Trash2 className="size-4 text-slate-400" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ExportForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (config: Omit<import("@/types").DataExportConfig, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<DataExportFormat>("csv");
  const [dataSource, setDataSource] = useState("runs");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), format, dataSource });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="export-name">Export Name</Label>
        <Input id="export-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Monthly Report" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as DataExportFormat)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
              <SelectItem value="xml">XML</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Data Source</Label>
          <Select value={dataSource} onValueChange={setDataSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="runs">Test Runs</SelectItem>
              <SelectItem value="tests">Tests</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
              <SelectItem value="all">All Data</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Create</Button>
      </div>
    </form>
  );
}
