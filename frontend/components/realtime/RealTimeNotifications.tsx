"use client";

import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, Info, AlertTriangle, MessageSquare, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRealTimeStore } from "@/store/realtime-store";
import type { RealTimeNotification } from "@/types";

const typeIcons: Record<RealTimeNotification["type"], typeof Bell> = {
  mention: Users,
  comment: MessageSquare,
  update: Info,
  alert: AlertTriangle,
  system: Bell,
};

const typeColors: Record<RealTimeNotification["type"], string> = {
  mention: "bg-sky-100 text-sky-700",
  comment: "bg-violet-100 text-violet-700",
  update: "bg-emerald-100 text-emerald-700",
  alert: "bg-amber-100 text-amber-700",
  system: "bg-slate-100 text-slate-700",
};

export function RealTimeNotifications() {
  const [isExpanded, setIsExpanded] = useState(false);
  const notifications = useRealTimeStore((state) => state.notifications);
  const markRead = useRealTimeStore((state) => state.markNotificationRead);
  const markAllRead = useRealTimeStore((state) => state.markAllNotificationsRead);
  const clearAll = useRealTimeStore((state) => state.clearNotifications);
  const unreadCount = useRealTimeStore((state) => state.unreadCount());

  return (
    <section aria-labelledby="rt-notifications-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <CardTitle id="rt-notifications-heading" className="text-base">Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                <CheckCheck className="mr-1 size-4" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <Trash2 className="mr-1 size-4" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Bell className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No notifications</p>
              <p className="text-sm">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, isExpanded ? notifications.length : 5).map((notification) => {
                const Icon = typeIcons[notification.type];

                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      notification.read ? "opacity-60" : typeColors[notification.type]
                    }`}
                  >
                    <Icon className="mt-0.5 size-5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-slate-600">{notification.message}</p>
                      {notification.from && (
                        <p className="mt-1 text-xs text-slate-500">From: {notification.from}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => markRead(notification.id)}
                      >
                        <Check className="size-4 text-slate-400" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {notifications.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 w-full"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "Show less" : `Show all ${notifications.length}`}
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
