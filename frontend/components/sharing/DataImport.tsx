"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTestStore } from "@/store/test-store";
import type { CreateTestInput, ImportedData } from "@/types";

export function DataImport() {
  const [importResult, setImportResult] = useState<ImportedData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createTest = useTestStore((state) => state.createTest);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const content = await file.text();
      let data: ImportedData;

      if (file.name.endsWith(".json")) {
        data = importFromJSON(content);
      } else if (file.name.endsWith(".csv")) {
        data = importFromCSV(content);
      } else {
        setImportResult({
          count: 0,
          errors: ["Unsupported file format. Please use JSON or CSV."],
        });
        setIsImporting(false);
        return;
      }

      // Create tests from imported data
      if (data.tests) {
        data.tests.forEach((test) => {
          createTest(test);
        });
      }

      setImportResult(data);
    } catch {
      setImportResult({
        count: 0,
        errors: ["Failed to parse file. Please check the format."],
      });
    }

    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <section aria-labelledby="import-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle id="import-heading" className="text-base">Import Data</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed p-6 text-center">
              <Upload className="mx-auto mb-2 size-8 text-slate-400" />
              <p className="text-sm text-slate-600">
                Drag and drop a file, or{" "}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="font-medium text-sky-600 hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="mt-1 text-xs text-slate-500">Supports JSON and CSV files</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {isImporting && (
              <div className="flex items-center justify-center gap-2 py-4">
                <div className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
                <span className="text-sm text-slate-600">Importing...</span>
              </div>
            )}

            {importResult && (
              <div className={`rounded-lg border p-4 ${
                importResult.errors.length > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
              }`}>
                <div className="flex items-start gap-3">
                  {importResult.errors.length > 0 ? (
                    <AlertTriangle className="mt-0.5 size-5 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
                  )}
                  <div>
                    <p className="font-medium">
                      {importResult.errors.length > 0
                        ? "Import completed with errors"
                        : "Import successful"}
                    </p>
                    <p className="text-sm text-slate-600">
                      {importResult.count} item(s) imported
                    </p>
                    {importResult.errors.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-sm text-amber-700">
                        {importResult.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800">
              <p className="font-medium text-slate-700 dark:text-slate-300">Supported formats:</p>
              <ul className="mt-1 list-inside list-disc space-y-1">
                <li><strong>JSON:</strong> Array of test objects with name, scriptType, targetUrl, virtualUsers</li>
                <li><strong>CSV:</strong> Headers: name, scriptType, targetUrl, virtualUsers</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function importFromJSON(content: string): ImportedData {
  const errors: string[] = [];
  const tests: CreateTestInput[] = [];

  try {
    const data = JSON.parse(content);
    const items = Array.isArray(data) ? data : data.tests || data.data || [];

    items.forEach((item: Record<string, unknown>, index: number) => {
      if (!item.name || !item.targetUrl) {
        errors.push(`Row ${index + 1}: Missing required fields (name, targetUrl)`);
        return;
      }

      const validTypes = ["HTTP", "TruClient", "JMeter"];
      const scriptType = validTypes.includes(item.scriptType as string)
        ? (item.scriptType as "HTTP" | "TruClient" | "JMeter")
        : "HTTP";

      tests.push({
        name: String(item.name),
        description: String(item.description || ""),
        scriptType,
        targetUrl: String(item.targetUrl),
        virtualUsers: Number(item.virtualUsers) || 100,
      });
    });
  } catch {
    errors.push("Invalid JSON format");
  }

  return { tests, count: tests.length, errors };
}

function importFromCSV(content: string): ImportedData {
  const errors: string[] = [];
  const tests: CreateTestInput[] = [];

  try {
    const lines = content.trim().split("\n");
    if (lines.length < 2) {
      errors.push("CSV file is empty or missing data rows");
      return { count: 0, errors };
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    const nameIdx = headers.indexOf("name");
    const scriptTypeIdx = headers.indexOf("scripttype");
    const targetUrlIdx = headers.indexOf("targeturl");
    const virtualUsersIdx = headers.indexOf("virtualusers");

    if (nameIdx === -1 || targetUrlIdx === -1) {
      errors.push("CSV must have 'name' and 'targetUrl' columns");
      return { count: 0, errors };
    }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());

      if (!values[nameIdx] || !values[targetUrlIdx]) {
        errors.push(`Row ${i + 1}: Missing required fields`);
        continue;
      }

      const validTypes = ["HTTP", "TruClient", "JMeter"];
      const scriptType = scriptTypeIdx !== -1 && validTypes.includes(values[scriptTypeIdx])
        ? (values[scriptTypeIdx] as "HTTP" | "TruClient" | "JMeter")
        : "HTTP";

      tests.push({
        name: values[nameIdx],
        scriptType,
        targetUrl: values[targetUrlIdx],
        virtualUsers: virtualUsersIdx !== -1 ? Number(values[virtualUsersIdx]) || 100 : 100,
      });
    }
  } catch {
    errors.push("Failed to parse CSV file");
  }

  return { tests, count: tests.length, errors };
}
