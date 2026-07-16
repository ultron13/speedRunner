"use client";

import { useState } from "react";
import { Download, Loader2, Eye, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTestStore } from "@/store/test-store";
import { useReportingStore } from "@/store/reporting-store";
import { ReportPreview } from "@/components/reporting/ReportPreview";
import { generateReportHTML, type ReportData } from "@/lib/report-pdf";

export function ReportGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState("");

  const tests = useTestStore((state) => state.tests);
  const runs = useTestStore((state) => state.runs);
  const slaThresholds = useTestStore((state) => state.slaThresholds);
  const templates = useReportingStore((state) => state.templates);
  const applyTemplate = useReportingStore((state) => state.applyTemplate);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleGenerate = (preview: boolean) => {
    if (!selectedTemplate) return;

    setIsGenerating(true);

    setTimeout(() => {
      const data: ReportData = {
        generatedAt: new Date().toISOString(),
        template: selectedTemplate,
        tests,
        runs,
        slaThresholds,
      };

      const html = generateReportHTML(data);
      const filename = `speedrunner-${selectedTemplate.type}-report-${new Date().toISOString().split("T")[0]}.html`;

      applyTemplate(selectedTemplateId);

      if (preview) {
        setPreviewHtml(html);
        setPreviewFilename(filename);
      } else {
        const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
      }

      setIsGenerating(false);
    }, 300);
  };

  return (
    <>
      <section aria-labelledby="report-heading">
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
            <CardTitle id="report-heading" className="text-base flex items-center gap-2">
              <FileText className="size-4" />
              Generate Report
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Report Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} — {t.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <p className="text-xs text-slate-500">{selectedTemplate.description}</p>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => handleGenerate(true)}
                  disabled={!selectedTemplate || isGenerating}
                  variant="outline"
                  className="flex-1"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Eye className="mr-2 size-4" />
                  )}
                  Preview
                </Button>
                <Button
                  onClick={() => handleGenerate(false)}
                  disabled={!selectedTemplate || isGenerating}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 size-4" />
                  )}
                  Download
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {previewHtml && (
        <ReportPreview
          html={previewHtml}
          filename={previewFilename}
          onClose={() => setPreviewHtml(null)}
        />
      )}
    </>
  );
}
