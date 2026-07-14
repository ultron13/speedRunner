"use client";

import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScriptType, TestStatus } from "@/types";

interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: TestStatus | "all";
  onStatusFilterChange: (status: TestStatus | "all") => void;
  typeFilter: ScriptType | "all";
  onTypeFilterChange: (type: ScriptType | "all") => void;
}

const statusOptions: Array<{ value: TestStatus | "all"; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "idle", label: "Idle" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "stopped", label: "Stopped" },
  { value: "failed", label: "Failed" },
];

const typeOptions: Array<{ value: ScriptType | "all"; label: string }> = [
  { value: "all", label: "All Types" },
  { value: "HTTP", label: "HTTP" },
  { value: "TruClient", label: "TruClient" },
  { value: "JMeter", label: "JMeter" },
];

export function SearchFilter({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
}: SearchFilterProps) {
  const hasFilters = searchQuery || statusFilter !== "all" || typeFilter !== "all";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search tests..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Status:</span>
        <div className="flex gap-1">
          {statusOptions.map((option) => (
            <Badge
              key={option.value}
              variant={statusFilter === option.value ? "default" : "outline"}
              className={`cursor-pointer transition-colors ${
                statusFilter === option.value
                  ? "bg-sky-600 text-white hover:bg-sky-700"
                  : "hover:bg-slate-100"
              }`}
              onClick={() => onStatusFilterChange(option.value)}
            >
              {option.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Type Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Type:</span>
        <div className="flex gap-1">
          {typeOptions.map((option) => (
            <Badge
              key={option.value}
              variant={typeFilter === option.value ? "default" : "outline"}
              className={`cursor-pointer transition-colors ${
                typeFilter === option.value
                  ? "bg-violet-600 text-white hover:bg-violet-700"
                  : "hover:bg-slate-100"
              }`}
              onClick={() => onTypeFilterChange(option.value)}
            >
              {option.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearchChange("");
            onStatusFilterChange("all");
            onTypeFilterChange("all");
          }}
        >
          <X className="mr-1 size-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
