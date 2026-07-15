"use client";

import { CheckCircle2, AlertTriangle, Clock, Shield } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSecurityStore } from "@/store/security-store";
import type { ComplianceRequirement } from "@/types";

const statusConfig: Record<ComplianceRequirement["status"], { icon: typeof CheckCircle2; color: string }> = {
  compliant: { icon: CheckCircle2, color: "text-emerald-600" },
  "non-compliant": { icon: AlertTriangle, color: "text-rose-600" },
  pending: { icon: Clock, color: "text-amber-600" },
};

const categoryLabels: Record<ComplianceRequirement["category"], string> = {
  data: "Data Protection",
  access: "Access Control",
  audit: "Audit & Logging",
  encryption: "Encryption",
};

export function ComplianceAudit() {
  const compliance = useSecurityStore((state) => state.compliance);

  const compliantCount = compliance.filter((c) => c.status === "compliant").length;
  const totalCount = compliance.length;

  return (
    <section aria-labelledby="compliance-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <div className="flex items-center justify-between">
            <CardTitle id="compliance-heading" className="text-base flex items-center gap-2">
              <Shield className="size-4" />
              Compliance Status
            </CardTitle>
            <Badge variant={compliantCount === totalCount ? "default" : "destructive"}>
              {compliantCount}/{totalCount} Compliant
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="space-y-2">
            {compliance.map((item) => {
              const config = statusConfig[item.status];
              const Icon = config.icon;

              return (
                <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Icon className={`size-5 ${config.color}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{item.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {categoryLabels[item.category]}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">{item.description}</p>
                      {item.details && (
                        <p className="mt-1 text-xs text-slate-500">{item.details}</p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`capitalize ${
                      item.status === "compliant"
                        ? "bg-emerald-50 text-emerald-700"
                        : item.status === "non-compliant"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {item.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
