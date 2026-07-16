import { create } from "zustand";

import type { HelpArticle } from "@/types";

const defaultArticles: HelpArticle[] = [
  {
    id: "help-1",
    title: "Getting Started",
    content: "Welcome to SpeedRunner Enterprise! This guide will help you get started with the dashboard.",
    category: "basics",
    tags: ["beginner", "setup"],
  },
  {
    id: "help-2",
    title: "Creating Tests",
    content: "Learn how to create and configure load tests for your applications.",
    category: "tests",
    tags: ["tests", "configuration"],
  },
  {
    id: "help-3",
    title: "Understanding Metrics",
    content: "Learn about response time, throughput, error rate, and other key metrics.",
    category: "metrics",
    tags: ["metrics", "analytics"],
  },
  {
    id: "help-4",
    title: "Setting Up Alerts",
    content: "Configure alerts to notify you when thresholds are exceeded.",
    category: "alerts",
    tags: ["alerts", "notifications"],
  },
  {
    id: "help-5",
    title: "API Integration",
    content: "Integrate with external services using our API.",
    category: "integration",
    tags: ["api", "webhooks"],
  },
];

export interface HelpStore {
  articles: HelpArticle[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  getFilteredArticles: () => HelpArticle[];
}

export const useHelpStore = create<HelpStore>((set, get) => ({
  articles: defaultArticles,
  searchQuery: "",

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  getFilteredArticles: () => {
    const { articles, searchQuery } = get();
    if (!searchQuery) return articles;
    const lower = searchQuery.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(lower) ||
        a.content.toLowerCase().includes(lower) ||
        a.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  },
}));
