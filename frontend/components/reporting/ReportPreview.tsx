"use client";

import { useRef } from "react";
import { Download, Printer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { triggerPrintPDF, downloadReportHTML } from "@/lib/report-pdf";

interface ReportPreviewProps {
  html: string;
  filename: string;
  onClose: () => void;
}

export function ReportPreview({ html, filename, onClose }: ReportPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    triggerPrintPDF(html, filename);
  };

  const handleDownload = () => {
    downloadReportHTML(html, filename.replace(/\.html$/, ".html"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex h-[90vh] w-[90vw] flex-col rounded-xl border bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Report Preview</h2>
            <p className="text-xs text-slate-500">{filename}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-1.5 size-4" />
              Print / PDF
            </Button>
            <Button size="sm" onClick={handleDownload}>
              <Download className="mr-1.5 size-4" />
              Download HTML
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Preview iframe */}
        <div className="flex-1 overflow-hidden p-4">
          <iframe
            ref={iframeRef}
            srcDoc={html}
            className="h-full w-full rounded-lg border"
            title="Report preview"
          />
        </div>
      </div>
    </div>
  );
}
