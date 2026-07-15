"use client";

import { useState } from "react";
import { Shield, ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSecurityStore } from "@/store/security-store";

export function TwoFactorAuth() {
  const [showSetup, setShowSetup] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const twoFactorAuth = useSecurityStore((state) => state.twoFactorAuth);
  const enable2FA = useSecurityStore((state) => state.enable2FA);
  const disable2FA = useSecurityStore((state) => state.disable2FA);
  const verify2FA = useSecurityStore((state) => state.verify2FA);
  const regenerateBackupCodes = useSecurityStore((state) => state.regenerateBackupCodes);

  const handleEnable = () => {
    enable2FA();
    setShowSetup(true);
  };

  const handleVerify = () => {
    if (verify2FA(verificationCode)) {
      setShowSetup(false);
      setVerificationCode("");
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <section aria-labelledby="twofa-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle id="twofa-heading" className="text-base flex items-center gap-2">
            <Shield className="size-4" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              {twoFactorAuth.enabled ? (
                <ShieldCheck className="size-8 text-emerald-600" />
              ) : (
                <ShieldOff className="size-8 text-slate-400" />
              )}
              <div>
                <p className="font-medium">
                  {twoFactorAuth.enabled ? "2FA Enabled" : "2FA Disabled"}
                </p>
                <p className="text-sm text-slate-500">
                  {twoFactorAuth.enabled
                    ? "Your account is protected with two-factor authentication"
                    : "Add an extra layer of security to your account"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {twoFactorAuth.enabled ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShowBackupCodes(!showBackupCodes)}>
                    View Backup Codes
                  </Button>
                  <Button variant="outline" size="sm" onClick={disable2FA}>
                    Disable
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={handleEnable}>
                  Enable 2FA
                </Button>
              )}
            </div>
          </div>

          {/* Setup Form */}
          {showSetup && (
            <div className="mt-4 rounded-lg border border-dashed p-4">
              <h4 className="mb-3 font-medium">Setup Two-Factor Authentication</h4>
              <div className="space-y-3">
                <div className="rounded-lg bg-slate-100 p-3 text-center dark:bg-slate-800">
                  <p className="mb-2 text-sm text-slate-600">Enter this secret in your authenticator app:</p>
                  <p className="font-mono text-lg font-bold tracking-wider">
                    {twoFactorAuth.secret || "JBSWY3DPEHPK3PXP"}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="verify-code">Verification Code</Label>
                  <Input
                    id="verify-code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowSetup(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleVerify} disabled={verificationCode.length !== 6}>
                    Verify & Enable
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Backup Codes */}
          {showBackupCodes && twoFactorAuth.backupCodes.length > 0 && (
            <div className="mt-4 rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-medium">Backup Codes</h4>
                <Button variant="ghost" size="sm" onClick={regenerateBackupCodes}>
                  Regenerate
                </Button>
              </div>
              <p className="mb-3 text-sm text-slate-500">
                Save these codes in a safe place. Each code can only be used once.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {twoFactorAuth.backupCodes.map((code, index) => (
                  <div key={index} className="flex items-center justify-between rounded border px-2 py-1">
                    <code className="font-mono text-sm">{code}</code>
                    <button
                      onClick={() => handleCopy(code)}
                      className="ml-2 text-slate-400 hover:text-slate-600"
                    >
                      {copiedCode === code ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
