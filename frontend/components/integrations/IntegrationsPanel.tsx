"use client";

import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIntegrationStore } from "@/store/integration-store";
import type { IntegrationStatus } from "@/types";

const statusConfig: Record<IntegrationStatus["status"], { icon: typeof CheckCircle2; color: string; label: string }> = {
  connected: { icon: CheckCircle2, color: "text-emerald-600", label: "Connected" },
  disconnected: { icon: XCircle, color: "text-slate-400", label: "Disconnected" },
  error: { icon: AlertTriangle, color: "text-amber-600", label: "Error" },
};

const typeLabels: Record<IntegrationStatus["type"], string> = {
  webhook: "Webhook",
  api: "API Integration",
  ci: "CI/CD",
  notification: "Notification",
};

export function IntegrationsPanel() {
  const integrations = useIntegrationStore((state) => state.integrations);
  const connectIntegration = useIntegrationStore((state) => state.connectIntegration);
  const disconnectIntegration = useIntegrationStore((state) => state.disconnectIntegration);

  return (
    <section aria-labelledby="integrations-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle id="integrations-heading" className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="space-y-2">
            {integrations.map((integration) => {
              const config = statusConfig[integration.status];
              const Icon = config.icon;

              return (
                <div key={integration.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Icon className={`size-5 ${config.color}`} />
                    <div>
                      <p className="text-sm font-medium">{integration.name}</p>
                      <p className="text-xs text-slate-500">{typeLabels[integration.type]}</p>
                    </div>
                  </div>
                  <Button
                    variant={integration.status === "connected" ? "outline" : "default"}
                    size="sm"
                    onClick={() =>
                      integration.status === "connected"
                        ? disconnectIntegration(integration.id)
                        : connectIntegration(integration.id)
                    }
                  >
                    {integration.status === "connected" ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
