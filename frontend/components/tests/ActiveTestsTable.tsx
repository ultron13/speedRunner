"use client";

import { useState, useMemo } from "react";
import { FlaskConical, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTimestamp } from "@/lib/utils";
import { useTestStore } from "@/store/test-store";
import type { RunStatus, ScriptType, TestStatus } from "@/types";

import { SearchFilter } from "./SearchFilter";
import { TestActions } from "./TestActions";
import { TestDetailPanel } from "./TestDetailPanel";

const statusClasses: Record<TestStatus | RunStatus, string> = {
  idle: "border-slate-200 bg-slate-100 text-slate-700",
  running: "border-sky-200 bg-sky-50 text-sky-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  stopped: "border-amber-200 bg-amber-50 text-amber-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
};

export function StatusBadge({ status }: { status: TestStatus | RunStatus }) {
  return (
    <Badge variant="outline" className={`capitalize ${statusClasses[status]}`}>
      <span className={`size-1.5 rounded-full ${status === "running" ? "animate-pulse bg-sky-500" : status === "completed" ? "bg-emerald-500" : status === "failed" ? "bg-rose-500" : status === "stopped" ? "bg-amber-500" : "bg-slate-400"}`} />
      {status}
    </Badge>
  );
}

type SortField = "name" | "scriptType" | "virtualUsers" | "status" | "lastRunAt";
type SortDirection = "asc" | "desc";

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return <ArrowUpDown className="ml-1 size-3 text-slate-400" />;
  return sortDirection === "asc" ? (
    <ArrowUp className="ml-1 size-3" />
  ) : (
    <ArrowDown className="ml-1 size-3" />
  );
}

export function ActiveTestsTable() {
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TestStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ScriptType | "all">("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const selectedTestIds = useTestStore((state) => state.selectedTestIds);
  const toggleTestSelection = useTestStore((state) => state.toggleTestSelection);

  const allTests = useTestStore(
    useShallow((state) =>
      state.tests.filter((t) => t.status === "idle" || t.status === "running"),
    ),
  );

  const filteredAndSortedTests = useMemo(() => {
    let result = [...allTests];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.targetUrl.toLowerCase().includes(query),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((t) => t.scriptType === typeFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "scriptType":
          comparison = a.scriptType.localeCompare(b.scriptType);
          break;
        case "virtualUsers":
          comparison = a.virtualUsers - b.virtualUsers;
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "lastRunAt":
          comparison =
            (a.lastRunAt ?? "").localeCompare(b.lastRunAt ?? "");
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [allTests, searchQuery, statusFilter, typeFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <section aria-labelledby="active-tests-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="space-y-4 px-5 py-4">
          <CardTitle id="active-tests-heading" className="text-base">Active Tests</CardTitle>
          <SearchFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
          />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {filteredAndSortedTests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-slate-500">
              <FlaskConical className="size-8 text-slate-300" aria-hidden="true" />
              <p className="font-medium text-slate-700">
                {allTests.length === 0 ? "No active tests" : "No tests match your filters"}
              </p>
              <p className="text-sm">
                {allTests.length === 0
                  ? "Create a test to begin performance monitoring."
                  : "Try adjusting your search or filter criteria."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-10 pl-5">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("name")}
                  >
                    Name <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("scriptType")}
                  >
                    Script Type <SortIcon field="scriptType" sortField={sortField} sortDirection={sortDirection} />
                  </TableHead>
                  <TableHead>Target URL</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("virtualUsers")}
                  >
                    Virtual Users <SortIcon field="virtualUsers" sortField={sortField} sortDirection={sortDirection} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("status")}
                  >
                    Status <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("lastRunAt")}
                  >
                    Last Run <SortIcon field="lastRunAt" sortField={sortField} sortDirection={sortDirection} />
                  </TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedTests.map((test) => {
                  const isSelected = selectedTestIds.includes(test.id);
                  return (
                    <TableRow
                      key={test.id}
                      className={`cursor-pointer hover:bg-slate-50 ${isSelected ? "bg-sky-50 dark:bg-sky-950" : ""}`}
                    >
                      <TableCell className="pl-5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTestSelection(test.id);
                          }}
                          className={`size-4 rounded border-2 ${
                            isSelected
                              ? "border-sky-500 bg-sky-500"
                              : "border-slate-300 hover:border-sky-400"
                          }`}
                          aria-label={`Select test ${test.name}`}
                        >
                          {isSelected && (
                            <svg className="size-full text-white" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
                            </svg>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="max-w-60"><p className="truncate font-medium">{test.name}</p><p className="truncate text-xs text-slate-500">{test.description || "No description"}</p></TableCell>
                    <TableCell>{test.scriptType}</TableCell><TableCell className="max-w-52 truncate text-slate-600" title={test.targetUrl}>{test.targetUrl}</TableCell><TableCell>{test.virtualUsers.toLocaleString()}</TableCell><TableCell><StatusBadge status={test.status} /></TableCell><TableCell className="text-slate-600">{formatTimestamp(test.lastRunAt)}</TableCell><TableCell className="pr-5" onClick={(e) => e.stopPropagation()}><TestActions testId={test.id} status={test.status} /></TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedTestId && (
        <TestDetailPanel
          testId={selectedTestId}
          onClose={() => setSelectedTestId(null)}
        />
      )}
    </section>
  );
}
