"use client";

import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

import type { Toast } from "@/hooks/useToast";

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const variantStyles = {
  default: "border-slate-200 bg-white text-slate-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

const variantIcons = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
};

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = variantIcons[toast.variant ?? "default"];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg ${variantStyles[toast.variant ?? "default"]} animate-in slide-in-from-right-full`}
          >
            <Icon className="mt-0.5 size-5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{toast.title}</p>
              {toast.description && (
                <p className="mt-1 text-sm opacity-80">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => onRemove(toast.id)}
              className="shrink-0 rounded p-1 opacity-50 hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
