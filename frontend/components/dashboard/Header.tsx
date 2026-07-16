"use client";

import { Activity, LogOut, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isGoBackendEnabled } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { useDashboardStore } from "@/store/dashboard-store";
import { useTestStore } from "@/store/test-store";
import { Notifications } from "./Notifications";
import { RefreshControls } from "./RefreshControls";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setCustomizing = useDashboardStore((state) => state.setCustomizing);
  const apiMode = useTestStore((state) => state.apiMode);
  const engineInfo = useTestStore((state) => state.engineInfo);
  const connected = useTestStore((state) => state.connected);

  const modeLabel = apiMode
    ? `API · ${engineInfo?.mode ?? "control plane"}`
    : connected
      ? "Live · WebSocket"
      : "Demo · local";

  return (
    <header className="border-b bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#032147] text-white shadow-sm">
            <Activity className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight dark:text-white">
              SpeedRunner Enterprise
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Performance workspace
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 text-sm text-slate-600 dark:text-slate-400 sm:flex">
            <span
              className={`size-2 rounded-full ${
                apiMode || connected ? "bg-emerald-500" : "bg-amber-500"
              }`}
              aria-hidden="true"
            />
            <span title={engineInfo?.engines?.join(", ") ?? modeLabel}>{modeLabel}</span>
            {apiMode && engineInfo?.k8s && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                K8s
              </span>
            )}
            {isGoBackendEnabled() && !apiMode && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                API fallback
              </span>
            )}
          </div>
          <RefreshControls />
          <Notifications />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCustomizing(true)}
            aria-label="Customize dashboard"
            title="Customize dashboard"
          >
            <Settings className="size-4 text-slate-400" />
          </Button>
          <ThemeToggle />
          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-slate-500">{user.role}</p>
              </div>
              <div className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600 dark:bg-slate-800">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={logout}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="size-4 text-slate-400" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
