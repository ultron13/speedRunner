"use client";

import { useState } from "react";
import { Activity, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({ email, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-[#032147] text-white shadow-lg">
            <Activity className="size-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight dark:text-white">
            SpeedRunner Enterprise
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to your performance workspace
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError();
                  }}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 border-t pt-4">
            <p className="mb-2 text-center text-xs text-slate-500">Demo accounts:</p>
            <div className="space-y-1 text-xs text-slate-600">
              <p>
                <span className="font-medium">Control plane:</span> admin@speedrunner.local /
                admin123
              </p>
              <p>
                <span className="font-medium">Mock admin:</span> admin@example.com / admin123
              </p>
              <p>
                <span className="font-medium">Mock editor:</span> editor@example.com / editor123
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
