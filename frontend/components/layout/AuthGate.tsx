"use client";

import { useEffect, type ReactNode } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { useAuthStore } from "@/store/auth-store";
import { useTestStore } from "@/store/test-store";
import { isGoBackendEnabled } from "@/lib/api-client";
import { useTheme } from "@/hooks/useTheme";

export function AuthGate({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const hydrate = useTestStore((s) => s.hydrate);
  const rehydrateFromApi = useTestStore((s) => s.rehydrateFromApi);
  useTheme();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (isGoBackendEnabled()) {
      void rehydrateFromApi().catch(() => hydrate());
    } else {
      hydrate();
    }
  }, [isAuthenticated, hydrate, rehydrateFromApi]);

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
