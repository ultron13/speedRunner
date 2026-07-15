"use client";

import { useState } from "react";
import { Activity, Trash2, Filter, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCollaborationStore } from "@/store/collaboration-store";

const actionColors: Record<string, string> = {
  created: "bg-emerald-100 text-emerald-700",
  updated: "bg-sky-100 text-sky-700",
  deleted: "bg-rose-100 text-rose-700",
  started: "bg-violet-100 text-violet-700",
  stopped: "bg-amber-100 text-amber-700",
  exported: "bg-slate-100 text-slate-700",
};

export function UserActivityFeed() {
  const [filter, setFilter] = useState("");
  const activities = useCollaborationStore((state) => state.activities);
  const clearActivities = useCollaborationStore((state) => state.clearActivities);

  const filteredActivities = filter
    ? activities.filter(
        (a) =>
          a.userName.toLowerCase().includes(filter.toLowerCase()) ||
          a.action.toLowerCase().includes(filter.toLowerCase()) ||
          a.entityName.toLowerCase().includes(filter.toLowerCase()),
      )
    : activities;

  return (
    <section aria-labelledby="activity-feed-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="activity-feed-heading" className="text-base">Activity Feed</CardTitle>
          <div className="flex items-center gap-2">
            {activities.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearActivities}>
                <Trash2 className="mr-1 size-4" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {/* Filter */}
          <div className="mb-4 relative">
            <Filter className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Filter activity..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Activity className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No activity yet</p>
              <p className="text-sm">Team activity will appear here.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
              <div className="space-y-3">
                {filteredActivities.slice(0, 30).map((activity) => (
                  <div key={activity.id} className="relative flex gap-3">
                    <div className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                      <User className="size-3.5 text-slate-600" />
                    </div>
                    <div className="flex-1 rounded-lg border p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{activity.userName}</span>
                        <Badge className={actionColors[activity.action] || "bg-slate-100 text-slate-700"}>
                          {activity.action}
                        </Badge>
                        <span className="text-sm text-slate-600">{activity.entityName}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
