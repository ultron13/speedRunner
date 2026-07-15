"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Clock, Bookmark, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSearchStore, quickFilters } from "@/store/search-store";
import { useTestStore } from "@/store/test-store";
import type { SearchableEntityType } from "@/types";

const entityTypeLabels: Record<SearchableEntityType, string> = {
  test: "Test",
  run: "Run",
  template: "Template",
  schedule: "Schedule",
  user: "User",
  webhook: "Webhook",
};

const entityTypeColors: Record<SearchableEntityType, string> = {
  test: "bg-sky-100 text-sky-700",
  run: "bg-emerald-100 text-emerald-700",
  template: "bg-violet-100 text-violet-700",
  schedule: "bg-amber-100 text-amber-700",
  user: "bg-rose-100 text-rose-700",
  webhook: "bg-slate-100 text-slate-700",
};

export function GlobalSearch() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");
  const [showSaveFilter, setShowSaveFilter] = useState(false);

  const query = useSearchStore((state) => state.query);
  const filters = useSearchStore((state) => state.filters);
  const results = useSearchStore((state) => state.results);
  const history = useSearchStore((state) => state.history);
  const savedFilters = useSearchStore((state) => state.savedFilters);
  const isSearching = useSearchStore((state) => state.isSearching);
  const setQuery = useSearchStore((state) => state.setQuery);
  const setFilters = useSearchStore((state) => state.setFilters);
  const search = useSearchStore((state) => state.search);
  const clearResults = useSearchStore((state) => state.clearResults);
  const addToHistory = useSearchStore((state) => state.addToHistory);
  const clearHistory = useSearchStore((state) => state.clearHistory);
  const saveFilter = useSearchStore((state) => state.saveFilter);
  const loadFilter = useSearchStore((state) => state.loadFilter);
  const deleteFilter = useSearchStore((state) => state.deleteFilter);

  const tests = useTestStore((state) => state.tests);
  const runs = useTestStore((state) => state.runs);
  const templates = useTestStore((state) => state.templates);
  const schedules = useTestStore((state) => state.schedules);

  const performSearch = useCallback(() => {
    search({
      tests,
      runs,
      templates,
      schedules,
    });

    if (query.trim()) {
      addToHistory(query, results.length);
    }
  }, [search, tests, runs, templates, schedules, query, addToHistory, results.length]);

  useEffect(() => {
    if (query.trim()) {
      const debounce = setTimeout(performSearch, 300);
      return () => clearTimeout(debounce);
    } else {
      clearResults();
    }
  }, [query, performSearch, clearResults]);

  const toggleEntityType = (type: SearchableEntityType) => {
    const current = filters.entityTypes;
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setFilters({ ...filters, entityTypes: updated });
  };

  const handleSaveFilter = () => {
    if (saveFilterName.trim()) {
      saveFilter(saveFilterName.trim());
      setSaveFilterName("");
      setShowSaveFilter(false);
    }
  };

  return (
    <section aria-labelledby="search-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="search-heading" className="text-base flex items-center gap-2">
            <Search className="size-4" />
            Global Search
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tests, runs, templates..."
              className="pl-9"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  clearResults();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Entity Type Filters */}
          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(entityTypeLabels) as SearchableEntityType[]).map((type) => (
              <Badge
                key={type}
                variant={filters.entityTypes.includes(type) ? "default" : "outline"}
                className={`cursor-pointer ${
                  filters.entityTypes.includes(type)
                    ? entityTypeColors[type]
                    : "hover:bg-slate-100"
                }`}
                onClick={() => toggleEntityType(type)}
              >
                {entityTypeLabels[type]}
              </Badge>
            ))}
          </div>

          {/* Quick Filters */}
          {isExpanded && (
            <div className="mb-4 space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Quick Filters</p>
                <div className="flex flex-wrap gap-2">
                  {quickFilters.map((qf) => (
                    <Button
                      key={qf.name}
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters(qf.filters)}
                    >
                      {qf.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Saved Filters */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">Saved Filters</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSaveFilter(!showSaveFilter)}
                  >
                    <Bookmark className="mr-1 size-3" />
                    Save Current
                  </Button>
                </div>

                {showSaveFilter && (
                  <div className="mb-2 flex gap-2">
                    <Input
                      value={saveFilterName}
                      onChange={(e) => setSaveFilterName(e.target.value)}
                      placeholder="Filter name"
                      className="h-8 text-sm"
                    />
                    <Button size="sm" onClick={handleSaveFilter} disabled={!saveFilterName.trim()}>
                      Save
                    </Button>
                  </div>
                )}

                {savedFilters.length === 0 ? (
                  <p className="text-xs text-slate-500">No saved filters</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {savedFilters.map((sf) => (
                      <div key={sf.id} className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadFilter(sf.id)}
                        >
                          {sf.name}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => deleteFilter(sf.id)}
                        >
                          <Trash2 className="size-3 text-slate-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Search History */}
              {history.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">Recent Searches</p>
                    <Button variant="ghost" size="sm" onClick={clearHistory}>
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {history.slice(0, 5).map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setQuery(entry.query)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-slate-50"
                      >
                        <Clock className="size-3 text-slate-400" />
                        <span className="flex-1 truncate">{entry.query}</span>
                        <span className="text-xs text-slate-400">{entry.resultCount} results</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search Results */}
          {isSearching ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-500">Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">{results.length} result(s) found</p>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-start gap-3 rounded-lg border p-3 hover:bg-slate-50"
                  >
                    <Badge className={`mt-0.5 ${entityTypeColors[result.entityType]}`}>
                      {entityTypeLabels[result.entityType]}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{result.title}</p>
                      <p className="text-xs text-slate-500">{result.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : query.trim() ? (
            <p className="py-4 text-center text-sm text-slate-500">No results found</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
