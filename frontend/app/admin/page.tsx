"use client";

import Link from "next/link";
import {
  Building2,
  Cloud,
  KeyRound,
  Link2,
  ShoppingBag,
  Users,
  Leaf,
} from "lucide-react";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    href: "/admin/sso",
    title: "SSO / OIDC",
    desc: "OpenID Connect login, discovery status, demo sign-in",
    icon: KeyRound,
  },
  {
    href: "/admin/scim",
    title: "SCIM users",
    desc: "SCIM 2.0 directory — list, provision, deactivate",
    icon: Users,
  },
  {
    href: "/admin/connectors",
    title: "Connectors",
    desc: "Jira, Slack, GitHub, Datadog and ITSM/chat/CI hubs",
    icon: Link2,
  },
  {
    href: "/admin/tenants",
    title: "Tenants",
    desc: "Multi-tenant workspaces, plans, regions",
    icon: Building2,
  },
  {
    href: "/admin/marketplace",
    title: "Marketplace",
    desc: "Scripts, templates, and connectors catalog",
    icon: ShoppingBag,
  },
  {
    href: "/admin/finops",
    title: "FinOps & carbon",
    desc: "Cost estimate, carbon grade, green regions",
    icon: Leaf,
  },
  {
    href: "/aviator",
    title: "Aviator & runtime",
    desc: "EPE 25.3 AI, Splunk/OTEL, live VUser controls",
    icon: Cloud,
  },
  {
    href: "/admin/enterprise",
    title: "Enterprise 21–41",
    desc: "Portfolio, correlation, WAN, quotas, residency, self-health",
    icon: Building2,
  },
];

export default function AdminHubPage() {
  return (
    <AuthGate>
      <AppShell subtitle="Enterprise control plane" title="Admin & integrations">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Deep configuration for OIDC, SCIM provisioning, Jira defect filing, SaaS
          tenancy, marketplace assets, and FinOps sustainability.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.href} href={s.href} className="group">
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-500">{s.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </AppShell>
    </AuthGate>
  );
}
