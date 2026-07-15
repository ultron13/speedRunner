"use client";

import { useState } from "react";
import { Mail, Send, Loader2, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { EmailReport, ExportFormat } from "@/types";

export function EmailReports() {
  const [reports, setReports] = useState<EmailReport[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const sendReport = async (to: string[], subject: string, format: ExportFormat) => {
    const newReport: EmailReport = {
      id: `email-${Date.now()}`,
      to,
      subject,
      body: `Please find attached the SpeedRunner Enterprise report.`,
      attachmentFormat: format,
      sentAt: null,
      status: "pending",
    };

    setReports((prev) => [...prev, newReport]);
    setSendingId(newReport.id);
    setIsCreating(false);

    // Simulate sending
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const success = Math.random() > 0.1; // 90% success rate

    setReports((prev) =>
      prev.map((r) =>
        r.id === newReport.id
          ? {
              ...r,
              sentAt: new Date().toISOString(),
              status: success ? "sent" : "failed",
            }
          : r,
      ),
    );
    setSendingId(null);
  };

  return (
    <section aria-labelledby="email-reports-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="email-reports-heading" className="text-base">Email Reports</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Mail className="mr-1 size-4" />
            Send Report
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <EmailForm
              onSubmit={(to, subject, format) => sendReport(to, subject, format)}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {reports.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Mail className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No reports sent</p>
              <p className="text-sm">Send performance reports to your team via email.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div key={report.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{report.subject}</p>
                    <p className="text-xs text-slate-500">
                      To: {report.to.join(", ")}
                    </p>
                    {report.sentAt && (
                      <p className="text-xs text-slate-500">
                        Sent: {new Date(report.sentAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        report.status === "sent"
                          ? "default"
                          : report.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {sendingId === report.id ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      ) : report.status === "sent" ? (
                        <CheckCircle2 className="mr-1 size-3" />
                      ) : report.status === "failed" ? (
                        <XCircle className="mr-1 size-3" />
                      ) : null}
                      {report.status === "sent"
                        ? "Sent"
                        : report.status === "failed"
                          ? "Failed"
                          : "Pending"}
                    </Badge>
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

function EmailForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (to: string[], subject: string, format: ExportFormat) => void;
  onCancel: () => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("SpeedRunner Performance Report");
  const [format, setFormat] = useState<ExportFormat>("pdf");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) return;

    const emails = to.split(",").map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) return;

    onSubmit(emails, subject, format);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="email-to">Recipients (comma-separated)</Label>
        <Input
          id="email-to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="team@example.com, manager@example.com"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email-subject">Subject</Label>
        <Input
          id="email-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label>Attachment Format</Label>
        <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdf">PDF Report</SelectItem>
            <SelectItem value="csv">CSV Data</SelectItem>
            <SelectItem value="html">HTML Report</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          <Send className="mr-1 size-4" />
          Send
        </Button>
      </div>
    </form>
  );
}
