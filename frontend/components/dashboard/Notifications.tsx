"use client";

import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTestStore } from "@/store/test-store";

export function Notifications() {
  const [isOpen, setIsOpen] = useState(false);
  const notifications = useTestStore((state) => state.notifications);
  const markNotificationRead = useTestStore((state) => state.markNotificationRead);
  const clearNotifications = useTestStore((state) => state.clearNotifications);
  const unreadCount = useTestStore((state) => state.unreadNotificationCount());

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <Card className="absolute right-0 top-full z-50 mt-2 w-80 gap-0 py-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
              <CardTitle className="text-sm">Notifications</CardTitle>
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearNotifications}
                  className="h-7 text-xs"
                >
                  Clear all
                </Button>
              )}
            </CardHeader>
            <CardContent className="max-h-80 overflow-y-auto px-0 pb-0">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No notifications
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onRead={() => markNotificationRead(notification.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
  };
  onRead: () => void;
}) {
  const typeStyles: Record<string, string> = {
    sla_violation: "bg-amber-100 text-amber-700",
    test_complete: "bg-emerald-100 text-emerald-700",
    test_failed: "bg-rose-100 text-rose-700",
  };

  const timeAgo = getTimeAgo(notification.timestamp);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 ${
        notification.read ? "opacity-60" : ""
      }`}
    >
      <div
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
          typeStyles[notification.type] ?? "bg-slate-100 text-slate-700"
        }`}
      >
        {notification.type === "test_complete" ? (
          <Check className="size-3" />
        ) : notification.type === "test_failed" ? (
          <X className="size-3" />
        ) : (
          <Bell className="size-3" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{notification.title}</p>
        <p className="text-xs text-slate-500">{notification.message}</p>
        <p className="mt-1 text-xs text-slate-400">{timeAgo}</p>
      </div>
      {!notification.read && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRead}
          aria-label="Mark as read"
        >
          <CheckCheck className="size-4 text-slate-400" />
        </Button>
      )}
    </div>
  );
}

function getTimeAgo(timestamp: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(timestamp).getTime()) / 1000,
  );

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
