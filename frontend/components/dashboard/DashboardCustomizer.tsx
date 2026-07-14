"use client";

import { useState } from "react";
import { Eye, EyeOff, Save, Trash2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDashboardStore } from "@/store/dashboard-store";

export function DashboardCustomizer() {
  const [viewName, setViewName] = useState("");
  const sections = useDashboardStore((state) => state.sections);
  const views = useDashboardStore((state) => state.views);
  const activeViewId = useDashboardStore((state) => state.activeViewId);
  const isCustomizing = useDashboardStore((state) => state.isCustomizing);
  const toggleSectionVisibility = useDashboardStore((state) => state.toggleSectionVisibility);
  const saveView = useDashboardStore((state) => state.saveView);
  const loadView = useDashboardStore((state) => state.loadView);
  const deleteView = useDashboardStore((state) => state.deleteView);
  const resetToDefaults = useDashboardStore((state) => state.resetToDefaults);
  const setCustomizing = useDashboardStore((state) => state.setCustomizing);

  if (!isCustomizing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Customize Dashboard</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setCustomizing(false)}>
            Done
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Section Visibility */}
          <div>
            <h4 className="mb-2 text-sm font-medium">Sections</h4>
            <div className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => toggleSectionVisibility(section.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span>{section.label}</span>
                  {section.visible ? (
                    <Eye className="size-4 text-sky-600" />
                  ) : (
                    <EyeOff className="size-4 text-slate-400" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Save View */}
          <div className="border-t pt-4">
            <h4 className="mb-2 text-sm font-medium">Save Current Layout</h4>
            <div className="flex gap-2">
              <Input
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="View name"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (viewName.trim()) {
                    saveView(viewName.trim());
                    setViewName("");
                  }
                }}
                disabled={!viewName.trim()}
              >
                <Save className="mr-1 size-4" />
                Save
              </Button>
            </div>
          </div>

          {/* Saved Views */}
          {views.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="mb-2 text-sm font-medium">Saved Views</h4>
              <div className="space-y-1">
                {views.map((view) => (
                  <div
                    key={view.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      activeViewId === view.id
                        ? "bg-sky-50 dark:bg-sky-950"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <button
                      onClick={() => loadView(view.id)}
                      className="flex-1 text-left text-sm"
                    >
                      {view.name}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteView(view.id)}
                    >
                      <Trash2 className="size-4 text-slate-400" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          <div className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={resetToDefaults}>
              <RotateCcw className="mr-1 size-4" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
