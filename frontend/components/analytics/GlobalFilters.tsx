"use client";

import { useState } from "react";
import { Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { RunStatus, ScriptType } from "@/types";

interface GlobalFiltersProps {
  onFilterChange: (filters: {
    dateStart: string | null;
    dateEnd: string | null;
    statuses: RunStatus[];
    scriptTypes: ScriptType[];
  }) => void;
}

const statusOptions: RunStatus[] = ["completed", "stopped", "failed"];
const typeOptions: ScriptType[] = ["HTTP", "TruClient", "JMeter"];

export function GlobalFilters({ onFilterChange }: GlobalFiltersProps) {
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<RunStatus[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<ScriptType[]>([]);

  const hasFilters = dateStart || dateEnd || selectedStatuses.length > 0 || selectedTypes.length > 0;

  const applyFilters = () => {
    onFilterChange({
      dateStart: dateStart || null,
      dateEnd: dateEnd || null,
      statuses: selectedStatuses,
      scriptTypes: selectedTypes,
    });
  };

  const clearFilters = () => {
    setDateStart("");
    setDateEnd("");
    setSelectedStatuses([]);
    setSelectedTypes([]);
    onFilterChange({
      dateStart: null,
      dateEnd: null,
      statuses: [],
      scriptTypes: [],
    });
  };

  const toggleStatus = (status: RunStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  };

  const toggleType = (type: ScriptType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  return (
    <section aria-labelledby="filters-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="filters-heading" className="text-base flex items-center gap-2">
            <Filter className="size-4" />
            Global Filters
          </CardTitle>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 size-4" />
              Clear All
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="space-y-4">
            {/* Date Range */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="filter-start">Start Date</Label>
                <Input
                  id="filter-start"
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="filter-end">End Date</Label>
                <Input
                  id="filter-end"
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((status) => (
                  <Badge
                    key={status}
                    variant={selectedStatuses.includes(status) ? "default" : "outline"}
                    className={`cursor-pointer capitalize ${
                      selectedStatuses.includes(status)
                        ? "bg-sky-600 text-white"
                        : "hover:bg-slate-100"
                    }`}
                    onClick={() => toggleStatus(status)}
                  >
                    {status}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Script Type Filter */}
            <div className="space-y-2">
              <Label>Script Type</Label>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map((type) => (
                  <Badge
                    key={type}
                    variant={selectedTypes.includes(type) ? "default" : "outline"}
                    className={`cursor-pointer ${
                      selectedTypes.includes(type)
                        ? "bg-violet-600 text-white"
                        : "hover:bg-slate-100"
                    }`}
                    onClick={() => toggleType(type)}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>

            <Button onClick={applyFilters} className="w-full">
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
