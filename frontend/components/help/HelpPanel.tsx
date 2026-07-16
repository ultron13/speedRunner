"use client";

import { useState } from "react";
import { HelpCircle, Search, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useHelpStore } from "@/store/help-store";

const categoryColors: Record<string, string> = {
  basics: "bg-sky-100 text-sky-700",
  tests: "bg-emerald-100 text-emerald-700",
  metrics: "bg-violet-100 text-violet-700",
  alerts: "bg-amber-100 text-amber-700",
  integration: "bg-rose-100 text-rose-700",
};

export function HelpPanel() {
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const searchQuery = useHelpStore((state) => state.searchQuery);
  const setSearchQuery = useHelpStore((state) => state.setSearchQuery);
  const getFilteredArticles = useHelpStore((state) => state.getFilteredArticles);

  const articles = getFilteredArticles();

  return (
    <section aria-labelledby="help-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle id="help-heading" className="text-base flex items-center gap-2">
            <HelpCircle className="size-4" />
            Help & Documentation
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Articles */}
          <div className="space-y-2">
            {articles.map((article) => (
              <div key={article.id} className="rounded-lg border">
                <button
                  className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50"
                  onClick={() => setExpandedArticle(expandedArticle === article.id ? null : article.id)}
                >
                  <div className="flex items-center gap-2">
                    <Badge className={categoryColors[article.category] || "bg-slate-100 text-slate-700"}>
                      {article.category}
                    </Badge>
                    <span className="text-sm font-medium">{article.title}</span>
                  </div>
                  {expandedArticle === article.id ? (
                    <ChevronUp className="size-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="size-4 text-slate-400" />
                  )}
                </button>

                {expandedArticle === article.id && (
                  <div className="border-t p-3">
                    <p className="text-sm text-slate-600">{article.content}</p>
                    <div className="mt-2 flex gap-1">
                      {article.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {articles.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <BookOpen className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No articles found</p>
              <p className="text-sm">Try a different search term.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
