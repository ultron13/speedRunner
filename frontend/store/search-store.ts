import { create } from "zustand";

import type {
  SavedFilter,
  SearchFilters,
  SearchHistoryEntry,
  SearchResult,
} from "@/types";

const HISTORY_KEY = "speedrunner-search-history";
const SAVED_FILTERS_KEY = "speedrunner-saved-filters";

function getStoredHistory(): SearchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: SearchHistoryEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 50)));
}

function getStoredFilters(): SavedFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SAVED_FILTERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFilters(filters: SavedFilter[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
}

export interface SearchStore {
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  history: SearchHistoryEntry[];
  savedFilters: SavedFilter[];
  isSearching: boolean;

  setQuery: (query: string) => void;
  setFilters: (filters: SearchFilters) => void;
  search: (allData: {
    tests: Array<{ id: string; name: string; description: string; targetUrl: string; status: string; scriptType: string; virtualUsers: number }>;
    runs: Array<{ id: string; testName: string; status: string; duration: number; throughput: number; avgResponseTime: number; errorRate: number; completedAt: string }>;
    templates: Array<{ id: string; name: string; description: string; scriptType: string; targetUrl: string }>;
    schedules: Array<{ id: string; testName: string; frequency: string; nextRunAt: string }>;
  }) => void;
  clearResults: () => void;
  addToHistory: (query: string, resultCount: number) => void;
  clearHistory: () => void;
  saveFilter: (name: string) => void;
  loadFilter: (filterId: string) => void;
  deleteFilter: (filterId: string) => void;
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: "",
  filters: {
    entityTypes: ["test", "run", "template", "schedule"],
  },
  results: [],
  history: getStoredHistory(),
  savedFilters: getStoredFilters(),
  isSearching: false,

  setQuery: (query) => {
    set({ query });
  },

  setFilters: (filters) => {
    set({ filters });
  },

  search: (allData) => {
    const { query, filters } = get();
    if (!query.trim()) {
      set({ results: [], isSearching: false });
      return;
    }

    set({ isSearching: true });

    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search tests
    if (filters.entityTypes.includes("test")) {
      allData.tests.forEach((test) => {
        const nameMatch = test.name.toLowerCase().includes(lowerQuery);
        const descMatch = test.description.toLowerCase().includes(lowerQuery);
        const urlMatch = test.targetUrl.toLowerCase().includes(lowerQuery);

        if (nameMatch || descMatch || urlMatch) {
          results.push({
            id: test.id,
            entityType: "test",
            title: test.name,
            subtitle: `${test.scriptType} · ${test.virtualUsers} users · ${test.status}`,
            matchField: nameMatch ? "name" : descMatch ? "description" : "url",
            matchSnippet: nameMatch ? test.name : descMatch ? test.description : test.targetUrl,
            score: nameMatch ? 3 : descMatch ? 2 : 1,
          });
        }
      });
    }

    // Search runs
    if (filters.entityTypes.includes("run")) {
      allData.runs.forEach((run) => {
        const nameMatch = run.testName.toLowerCase().includes(lowerQuery);
        const statusMatch = run.status.toLowerCase().includes(lowerQuery);

        if (nameMatch || statusMatch) {
          results.push({
            id: run.id,
            entityType: "run",
            title: run.testName,
            subtitle: `${run.status} · ${run.duration}s · ${run.avgResponseTime}ms`,
            matchField: nameMatch ? "name" : "status",
            matchSnippet: nameMatch ? run.testName : run.status,
            score: nameMatch ? 3 : 1,
          });
        }
      });
    }

    // Search templates
    if (filters.entityTypes.includes("template")) {
      allData.templates.forEach((template) => {
        const nameMatch = template.name.toLowerCase().includes(lowerQuery);
        const descMatch = template.description.toLowerCase().includes(lowerQuery);

        if (nameMatch || descMatch) {
          results.push({
            id: template.id,
            entityType: "template",
            title: template.name,
            subtitle: `${template.scriptType} · ${template.targetUrl}`,
            matchField: nameMatch ? "name" : "description",
            matchSnippet: nameMatch ? template.name : template.description,
            score: nameMatch ? 3 : 2,
          });
        }
      });
    }

    // Search schedules
    if (filters.entityTypes.includes("schedule")) {
      allData.schedules.forEach((schedule) => {
        const nameMatch = schedule.testName.toLowerCase().includes(lowerQuery);
        const freqMatch = schedule.frequency.toLowerCase().includes(lowerQuery);

        if (nameMatch || freqMatch) {
          results.push({
            id: schedule.id,
            entityType: "schedule",
            title: schedule.testName,
            subtitle: `${schedule.frequency} · Next: ${new Date(schedule.nextRunAt).toLocaleDateString()}`,
            matchField: nameMatch ? "name" : "frequency",
            matchSnippet: nameMatch ? schedule.testName : schedule.frequency,
            score: nameMatch ? 3 : 1,
          });
        }
      });
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    set({ results, isSearching: false });
  },

  clearResults: () => {
    set({ results: [], query: "" });
  },

  addToHistory: (query, resultCount) => {
    const entry: SearchHistoryEntry = {
      id: `search-${Date.now()}`,
      query,
      filters: get().filters,
      timestamp: new Date().toISOString(),
      resultCount,
    };

    const updated = [entry, ...get().history.filter((h) => h.query !== query)].slice(0, 50);
    saveHistory(updated);
    set({ history: updated });
  },

  clearHistory: () => {
    saveHistory([]);
    set({ history: [] });
  },

  saveFilter: (name) => {
    const { filters } = get();
    const newFilter: SavedFilter = {
      id: `filter-${Date.now()}`,
      name,
      filters: { ...filters },
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };

    const updated = [...get().savedFilters, newFilter];
    saveFilters(updated);
    set({ savedFilters: updated });
  },

  loadFilter: (filterId) => {
    const filter = get().savedFilters.find((f) => f.id === filterId);
    if (filter) {
      set({ filters: { ...filter.filters } });
      // Increment usage count
      const updated = get().savedFilters.map((f) =>
        f.id === filterId ? { ...f, usageCount: f.usageCount + 1 } : f,
      );
      saveFilters(updated);
      set({ savedFilters: updated });
    }
  },

  deleteFilter: (filterId) => {
    const updated = get().savedFilters.filter((f) => f.id !== filterId);
    saveFilters(updated);
    set({ savedFilters: updated });
  },
}));

// Selector for quick filters
export const quickFilters: { name: string; filters: SearchFilters }[] = [
  { name: "All Tests", filters: { entityTypes: ["test"] } },
  { name: "All Runs", filters: { entityTypes: ["run"] } },
  { name: "All Templates", filters: { entityTypes: ["template"] } },
  { name: "Running Tests", filters: { entityTypes: ["test"], statuses: ["running"] } },
  { name: "Failed Runs", filters: { entityTypes: ["run"], statuses: ["failed"] } },
];
