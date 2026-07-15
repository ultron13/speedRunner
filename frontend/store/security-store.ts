import { create } from "zustand";

import type {
  ComplianceRequirement,
  SecurityAlert,
  SecurityState,
  TwoFactorAuth,
  UserSession,
} from "@/types";

const TWO_FACTOR_KEY = "speedrunner-2fa";
const SESSIONS_KEY = "speedrunner-sessions";
const COMPLIANCE_KEY = "speedrunner-compliance";
const ALERTS_KEY = "speedrunner-security-alerts";

function getStored<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function save<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

const defaultTwoFactor: TwoFactorAuth = {
  enabled: false,
  secret: "",
  backupCodes: [],
  lastVerified: null,
};

const defaultCompliance: ComplianceRequirement[] = [
  {
    id: "comp-1",
    name: "Data Encryption at Rest",
    description: "All data must be encrypted when stored",
    category: "encryption",
    status: "compliant",
    lastChecked: new Date().toISOString(),
    details: "AES-256 encryption enabled",
  },
  {
    id: "comp-2",
    name: "Data Encryption in Transit",
    description: "All data must be encrypted during transmission",
    category: "encryption",
    status: "compliant",
    lastChecked: new Date().toISOString(),
    details: "TLS 1.3 enabled",
  },
  {
    id: "comp-3",
    name: "Access Logging",
    description: "All access to sensitive data must be logged",
    category: "audit",
    status: "compliant",
    lastChecked: new Date().toISOString(),
    details: "Audit trail enabled",
  },
  {
    id: "comp-4",
    name: "Password Policy",
    description: "Passwords must meet complexity requirements",
    category: "access",
    status: "compliant",
    lastChecked: new Date().toISOString(),
    details: "Minimum 8 characters, mixed case, numbers",
  },
  {
    id: "comp-5",
    name: "Session Timeout",
    description: "Sessions must timeout after 30 minutes of inactivity",
    category: "access",
    status: "pending",
    lastChecked: new Date().toISOString(),
  },
];

const defaultSessions: UserSession[] = [
  {
    id: "session-1",
    userId: "user-1",
    device: "Desktop",
    browser: "Chrome 120",
    ipAddress: "192.168.1.100",
    location: "San Francisco, CA",
    lastActive: new Date().toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    isCurrent: true,
  },
  {
    id: "session-2",
    userId: "user-1",
    device: "Mobile",
    browser: "Safari 17",
    ipAddress: "192.168.1.101",
    location: "San Francisco, CA",
    lastActive: new Date(Date.now() - 7200000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    isCurrent: false,
  },
];

export interface SecurityStore extends SecurityState {
  enable2FA: () => { secret: string; backupCodes: string[] };
  disable2FA: () => void;
  verify2FA: (code: string) => boolean;
  regenerateBackupCodes: () => string[];

  terminateSession: (sessionId: string) => void;
  terminateAllSessions: () => void;

  updateComplianceStatus: (id: string, status: ComplianceRequirement["status"], details?: string) => void;

  addSecurityAlert: (alert: Omit<SecurityAlert, "id" | "timestamp" | "resolved">) => void;
  resolveSecurityAlert: (id: string) => void;
  clearSecurityAlerts: () => void;
}

export const useSecurityStore = create<SecurityStore>((set, get) => ({
  twoFactorAuth: getStored<TwoFactorAuth>(TWO_FACTOR_KEY, defaultTwoFactor),
  sessions: getStored<UserSession[]>(SESSIONS_KEY, defaultSessions),
  compliance: getStored<ComplianceRequirement[]>(COMPLIANCE_KEY, defaultCompliance),
  securityAlerts: getStored<SecurityAlert[]>(ALERTS_KEY, []),

  enable2FA: () => {
    const secret = generateSecret();
    const backupCodes = generateBackupCodes();
    const new2FA: TwoFactorAuth = {
      enabled: true,
      secret,
      backupCodes,
      lastVerified: null,
    };
    save(TWO_FACTOR_KEY, new2FA);
    set({ twoFactorAuth: new2FA });
    return { secret, backupCodes };
  },

  disable2FA: () => {
    const new2FA: TwoFactorAuth = {
      enabled: false,
      secret: "",
      backupCodes: [],
      lastVerified: null,
    };
    save(TWO_FACTOR_KEY, new2FA);
    set({ twoFactorAuth: new2FA });
  },

  verify2FA: (code) => {
    const { twoFactorAuth } = get();
    if (!twoFactorAuth.enabled) return false;

    // Simple verification simulation
    const isValid = code.length === 6 && /^\d+$/.test(code);
    if (isValid) {
      const updated = { ...twoFactorAuth, lastVerified: new Date().toISOString() };
      save(TWO_FACTOR_KEY, updated);
      set({ twoFactorAuth: updated });
    }
    return isValid;
  },

  regenerateBackupCodes: () => {
    const backupCodes = generateBackupCodes();
    const updated = { ...get().twoFactorAuth, backupCodes };
    save(TWO_FACTOR_KEY, updated);
    set({ twoFactorAuth: updated });
    return backupCodes;
  },

  terminateSession: (sessionId) => {
    const updated = get().sessions.filter((s) => s.id !== sessionId);
    save(SESSIONS_KEY, updated);
    set({ sessions: updated });
  },

  terminateAllSessions: () => {
    const currentSession = get().sessions.find((s) => s.isCurrent);
    const updated = currentSession ? [currentSession] : [];
    save(SESSIONS_KEY, updated);
    set({ sessions: updated });
  },

  updateComplianceStatus: (id, status, details) => {
    const updated = get().compliance.map((c) =>
      c.id === id
        ? { ...c, status, lastChecked: new Date().toISOString(), details: details ?? c.details }
        : c,
    );
    save(COMPLIANCE_KEY, updated);
    set({ compliance: updated });
  },

  addSecurityAlert: (alert) => {
    const newAlert: SecurityAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    const updated = [newAlert, ...get().securityAlerts].slice(0, 100);
    save(ALERTS_KEY, updated);
    set({ securityAlerts: updated });
  },

  resolveSecurityAlert: (id) => {
    const updated = get().securityAlerts.map((a) =>
      a.id === id ? { ...a, resolved: true } : a,
    );
    save(ALERTS_KEY, updated);
    set({ securityAlerts: updated });
  },

  clearSecurityAlerts: () => {
    save(ALERTS_KEY, []);
    set({ securityAlerts: [] });
  },
}));

function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}