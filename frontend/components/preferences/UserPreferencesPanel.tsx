"use client";

import { Settings, Globe, Clock, Bell, RefreshCw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePreferencesStore } from "@/store/preferences-store";
import { useTheme } from "@/hooks/useTheme";

export function UserPreferencesPanel() {
  const preferences = usePreferencesStore((state) => state.preferences);
  const updatePreferences = usePreferencesStore((state) => state.updatePreferences);
  const { theme, setTheme } = useTheme();

  return (
    <section aria-labelledby="preferences-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle id="preferences-heading" className="text-base flex items-center gap-2">
            <Settings className="size-4" />
            User Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-5 pb-4">
          {/* Theme */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Settings className="size-4" />
              Theme
            </Label>
            <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Globe className="size-4" />
              Language
            </Label>
            <Select value={preferences.language} onValueChange={(v) => updatePreferences({ language: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Clock className="size-4" />
              Timezone
            </Label>
            <Select value={preferences.timezone} onValueChange={(v) => updatePreferences({ timezone: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern Time</SelectItem>
                <SelectItem value="America/Chicago">Central Time</SelectItem>
                <SelectItem value="America/Denver">Mountain Time</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                <SelectItem value="Europe/London">London</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Bell className="size-4" />
              Notifications
            </Label>
            <button
              onClick={() => updatePreferences({ notifications: !preferences.notifications })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.notifications ? "bg-sky-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                  preferences.notifications ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Auto Refresh */}
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <RefreshCw className="size-4" />
              Auto Refresh
            </Label>
            <button
              onClick={() => updatePreferences({ autoRefresh: !preferences.autoRefresh })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.autoRefresh ? "bg-sky-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                  preferences.autoRefresh ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {preferences.autoRefresh && (
            <div className="grid gap-2">
              <Label>Refresh Interval (seconds)</Label>
              <Select
                value={String(preferences.refreshInterval)}
                onValueChange={(v) => updatePreferences({ refreshInterval: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
