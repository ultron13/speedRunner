"use client";

import { useState } from "react";
import { Upload, Plus, Trash2, FileText, FileSpreadsheet, Code } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDataUtilitiesStore } from "@/store/data-utilities-store";

const formatIcons: Record<string, typeof FileText> = {
  csv: FileSpreadsheet,
  json: Code,
  xml: Code,
};

const formatColors: Record<string, string> = {
  csv: "bg-emerald-100 text-emerald-700",
  json: "bg-sky-100 text-sky-700",
  xml: "bg-violet-100 text-violet-700",
};

export function DataImports() {
  const [isCreating, setIsCreating] = useState(false);
  const imports = useDataUtilitiesStore((state) => state.imports);
  const createImport = useDataUtilitiesStore((state) => state.createImport);
  const deleteImport = useDataUtilitiesStore((state) => state.deleteImport);

  return (
    <section aria-labelledby="imports-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="imports-heading" className="text-base">Data Imports</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Import
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <ImportForm
              onSubmit={(config) => {
                createImport(config);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {imports.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Upload className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No import configurations</p>
              <p className="text-sm">Create import configurations for quick data import.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {imports.map((imp) => {
                const Icon = formatIcons[imp.format] || FileText;
                return (
                  <div key={imp.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Badge className={formatColors[imp.format] || "bg-slate-100 text-slate-700"}>
                        <Icon className="mr-1 size-3" />
                        {imp.format.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{imp.name}</p>
                        <p className="text-xs text-slate-500">Target: {imp.dataSource}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => deleteImport(imp.id)}>
                      <Trash2 className="size-4 text-slate-400" />
                    </Button>
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

function ImportForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (config: Omit<import("@/types").DataImportConfig, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<"csv" | "json" | "xml">("csv");
  const [dataSource, setDataSource] = useState("tests");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), format, dataSource });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="import-name">Import Name</Label>
        <Input id="import-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Test Data Import" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as "csv" | "json" | "xml")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="xml">XML</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Target</Label>
          <Select value={dataSource} onValueChange={setDataSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tests">Tests</SelectItem>
              <SelectItem value="runs">Runs</SelectItem>
              <SelectItem value="templates">Templates</SelectItem>
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
