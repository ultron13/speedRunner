"use client";

import { Monitor, Smartphone, Trash2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSecurityStore } from "@/store/security-store";

export function SessionManagement() {
  const sessions = useSecurityStore((state) => state.sessions);
  const terminateSession = useSecurityStore((state) => state.terminateSession);
  const terminateAllSessions = useSecurityStore((state) => state.terminateAllSessions);

  return (
    <section aria-labelledby="sessions-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="sessions-heading" className="text-base">Active Sessions</CardTitle>
          {sessions.length > 1 && (
            <Button variant="ghost" size="sm" onClick={terminateAllSessions}>
              <LogOut className="mr-1 size-4" />
              Terminate All
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {sessions.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No active sessions</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    {session.device === "Mobile" ? (
                      <Smartphone className="size-5 text-slate-400" />
                    ) : (
                      <Monitor className="size-5 text-slate-400" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{session.device} - {session.browser}</p>
                        {session.isCurrent && (
                          <Badge variant="outline" className="text-xs">Current</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {session.location} · {session.ipAddress}
                      </p>
                      <p className="text-xs text-slate-500">
                        Last active: {new Date(session.lastActive).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => terminateSession(session.id)}
                    >
                      <Trash2 className="size-4 text-slate-400" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
