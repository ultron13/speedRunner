"use client";

import { useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";

import { apiClient, isGoBackendEnabled } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; text: string; meta?: string };

const DEMO_RESPONSES: Record<string, string> = {
  script:
    "Aviator (Scripting): Recommended protocol **Web - HTTP/HTML**. Add think-time, correlate dynamic tokens, and externalize secrets via Vault before production.",
  analysis:
    "Aviator (Analysis): avg≈180ms p95≈420ms. Tail latency risk detected. Investigate GC/lock contention and check Splunk APM service map.",
  default:
    "Aviator is ready (demo mode). Ask about scripting (protocol, optimize) or analysis (trends, anomalies). Connect NEXT_PUBLIC_API_URL for live control-plane AI.",
};

export function AviatorPanel({ className }: { className?: string }) {
  const [mode, setMode] = useState<"chat" | "script" | "analysis">("chat");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "OpenText-style Performance Engineering Aviator. I can help with AI scripting (protocol selection, optimize, summarize) and conversational analysis (trends, anomalies, release gates).",
    },
  ]);

  async function send() {
    const prompt = input.trim();
    if (!prompt || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setBusy(true);
    try {
      if (isGoBackendEnabled()) {
        const res = await apiClient.aviator({
          mode,
          prompt,
          context:
            mode === "analysis"
              ? { avgResponseTime: 180, p95: 420, errorRate: 1.2, throughput: 120 }
              : { application: prompt, script: "http.get('/api'); // sample" },
        });
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: res.answer,
            meta: [res.protocol, res.actions?.join(", ")].filter(Boolean).join(" · "),
          },
        ]);
      } else {
        const key = mode === "script" || mode === "analysis" ? mode : "default";
        setMessages((m) => [
          ...m,
          { role: "assistant", text: DEMO_RESPONSES[key] ?? DEMO_RESPONSES.default },
        ]);
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: e instanceof Error ? e.message : "Aviator request failed",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950",
        className,
      )}
      aria-label="Performance Engineering Aviator"
    >
      <header className="flex items-center justify-between border-b px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <Sparkles className="size-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Performance Engineering Aviator
            </h2>
            <p className="text-xs text-slate-500">EPE 25.3 AI scripting & analysis</p>
          </div>
        </div>
        <div className="flex gap-1" role="tablist" aria-label="Aviator mode">
          {(["chat", "script", "analysis"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                mode === m
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <div
        className="flex max-h-80 min-h-[220px] flex-col gap-3 overflow-y-auto p-4"
        role="log"
        aria-live="polite"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2 text-sm",
              msg.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            {msg.role === "assistant" && (
              <Bot className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden />
            )}
            <div
              className={cn(
                "max-w-[90%] rounded-lg px-3 py-2",
                msg.role === "user"
                  ? "bg-sky-600 text-white"
                  : "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100",
              )}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.meta && (
                <p className="mt-1 text-[11px] opacity-70">{msg.meta}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t p-3 dark:border-slate-800">
        <label className="sr-only" htmlFor="aviator-input">
          Message to Aviator
        </label>
        <input
          id="aviator-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={
            mode === "script"
              ? "Describe your app for protocol + script help…"
              : mode === "analysis"
                ? "Ask about latency, errors, trends…"
                : "Ask Aviator anything…"
          }
          className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700"
          disabled={busy}
        />
        <Button type="button" onClick={send} disabled={busy || !input.trim()} aria-label="Send">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </section>
  );
}
