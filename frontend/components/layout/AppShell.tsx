"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Calendar,
  FileText,
  Gauge,
  LayoutDashboard,
  Server,
  Shield,
  FlaskConical,
  Sparkles,
  Settings2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Header } from "@/components/dashboard/Header";
import { OfflineIndicator } from "@/components/mobile/OfflineIndicator";
import { MobileNav } from "@/components/mobile/MobileNav";
import { ToastContainer } from "@/components/ui/toast";
import { useToast } from "@/hooks/useToast";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tests", label: "Tests", icon: FlaskConical },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/aviator", label: "Aviator", icon: Sparkles },
  { href: "/schedules", label: "Schedules", icon: Calendar },
  { href: "/sla", label: "SLA", icon: Shield },
  { href: "/pools", label: "LG Pools", icon: Server },
  { href: "/engines", label: "Engines", icon: Gauge },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin", label: "Admin", icon: Settings2 },
];

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const { toasts, removeToast } = useToast();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Accessibility: skip link (EPE 25.3 / VPAT-oriented keyboard access) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-sky-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>
      <Header />
      <div className="mx-auto flex max-w-[1440px] gap-0 lg:gap-6 px-0 sm:px-4 lg:px-8">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-[calc(100vh-1px)] w-56 shrink-0 border-r py-6 pr-4 dark:border-slate-800 lg:block">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Platform
          </p>
          <nav className="space-y-0.5" aria-label="Main">
            {nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-8 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Gauge className="size-3.5" />
              Enterprise edition
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              LoadRunner-class control plane with multi-engine execution, SLA
              gates, and K8s load generators.
            </p>
          </div>
        </aside>

        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 space-y-6 px-4 py-6 sm:px-2 lg:px-0 outline-none"
        >
          {(title || subtitle) && (
            <div>
              {subtitle && (
                <p className="text-sm font-medium text-sky-700 dark:text-sky-400">
                  {subtitle}
                </p>
              )}
              {title && (
                <h1 className="mt-1 text-2xl font-bold tracking-tight dark:text-white sm:text-3xl">
                  {title}
                </h1>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
      <CreateTestFloating />
      <MobileNav />
      <OfflineIndicator />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function CreateTestFloating() {
  // Lazy import avoided — CreateTestModal is client-heavy; keep on dashboard only via children
  return null;
}
