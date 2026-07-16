"use client";

import { useState, useMemo } from "react";
import { Download, GitCompareArrows, History, Play, Copy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportRunsToCSV } from "@/lib/export";
import { formatDuration, formatMetric } from "@/lib/utils";
import { useTestStore } from "@/store/test-store";

import { StatusBadge } from "./ActiveTestsTable";

export function RecentRunsTable() {
  const [dateFilter, setDateFilter] = useState("");
  const allRuns = useTestStore((state) => state.runs);
  const selectedRunIds = useTestStore((state) => state.selectedRunIds);
  const toggleRunSelection = useTestStore((state) => state.toggleRunSelection);
  const replayTest = useTestStore((state) => state.replayTest);
  const cloneTestConfig = useTestStore((state) => state.cloneTestConfig);
  const [clonedConfig, setClonedConfig] = useState<ReturnType<typeof cloneTestConfig>>(null);

  const filteredRuns = useMemo(() => {
    let runs = [...allRuns].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );

    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      runs = runs.filter((run) => {
        const runDate = new Date(run.completedAt);
        return (
          runDate.getFullYear() === filterDate.getFullYear() &&
          runDate.getMonth() === filterDate.getMonth() &&
          runDate.getDate() === filterDate.getDate()
        );
      });
    }

    return runs.slice(0, 20);
  }, [allRuns, dateFilter]);

  const handleExport = () => {
    const runsToExport = dateFilter ? filteredRuns : allRuns;
    exportRunsToCSV(runsToExport, `test-runs${dateFilter ? `-${dateFilter}` : ""}.csv`);
  };

  const handleReplay = (runId: string) => {
    replayTest(runId);
  };

  const handleClone = (testId: string) => {
    const config = cloneTestConfig(testId);
    setClonedConfig(config);
  };

  return (
    <section aria-labelledby="recent-runs-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="recent-runs-heading" className="text-base">Recent Runs</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-8 w-40 text-sm"
              aria-label="Filter by date"
            />
            {selectedRunIds.length === 2 && (
              <Badge variant="outline" className="bg-sky-50 text-sky-700">
                <GitCompareArrows className="mr-1 size-3" />
                Comparing
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 size-4" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {filteredRuns.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-slate-500">
              <History className="size-8 text-slate-300" aria-hidden="true" />
              <p className="font-medium text-slate-700">
                {dateFilter ? "No runs on this date" : "No runs yet"}
              </p>
              <p className="text-sm">
                {dateFilter
                  ? "Try selecting a different date."
                  : "Stopped and completed tests will appear here."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-10 pl-5">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead>Test Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Throughput</TableHead>
                  <TableHead>Avg Response Time</TableHead>
                  <TableHead>Error Rate</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRuns.map((run) => {
                  const isSelected = selectedRunIds.includes(run.id);
                  return (
                    <TableRow
                      key={run.id}
                      className={isSelected ? "bg-sky-50 dark:bg-sky-950" : ""}
                    >
                      <TableCell className="pl-5">
                        <button
                          onClick={() => toggleRunSelection(run.id)}
                          className={`size-4 rounded border-2 ${
                            isSelected
                              ? "border-sky-500 bg-sky-500"
                              : "border-slate-300 hover:border-sky-400"
                          }`}
                          aria-label={`Select run ${run.testName}`}
                        >
                          {isSelected && (
                            <svg className="size-full text-white" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
                            </svg>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">{run.testName}</TableCell>
                      <TableCell><StatusBadge status={run.status} /></TableCell>
                      <TableCell>{formatDuration(run.duration)}</TableCell>
                      <TableCell>{formatMetric(run.throughput, "req/s")}</TableCell>
                      <TableCell>{formatMetric(run.avgResponseTime, "ms")}</TableCell>
                      <TableCell>{run.errorRate.toFixed(1)}%</TableCell>
                      <TableCell className="pr-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleReplay(run.id)}
                            title="Replay this test"
                            aria-label={`Replay ${run.testName}`}
                          >
                            <Play className="size-3.5 text-emerald-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleClone(run.testId)}
                            title="Clone test configuration"
                            aria-label={`Clone ${run.testName}`}
                          >
                            <Copy className="size-3.5 text-slate-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
