"use client";

import { useEffect } from "react";
import { Circle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRealTimeStore } from "@/store/realtime-store";
import type { OnlineUser } from "@/types";

const statusColors: Record<OnlineUser["status"], string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  busy: "bg-rose-500",
};

const statusLabels: Record<OnlineUser["status"], string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
};

export function OnlineUsers() {
  const onlineUsers = useRealTimeStore((state) => state.onlineUsers);
  const simulatePresence = useRealTimeStore((state) => state.simulatePresence);

  // Simulate presence updates every 10 seconds
  useEffect(() => {
    const interval = setInterval(simulatePresence, 10_000);
    return () => clearInterval(interval);
  }, [simulatePresence]);

  const onlineCount = onlineUsers.filter((u) => u.status === "online").length;

  return (
    <section aria-labelledby="presence-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <CardTitle id="presence-heading" className="text-base">Online Users</CardTitle>
            <Badge variant="outline">
              <Circle className="mr-1 size-2 fill-emerald-500 text-emerald-500" />
              {onlineCount} online
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="space-y-2">
            {onlineUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600 dark:bg-slate-800">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white ${statusColors[user.status]}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-slate-500">
                      {user.currentPage || "Unknown page"} · {statusLabels[user.status]}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {new Date(user.lastSeen).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
