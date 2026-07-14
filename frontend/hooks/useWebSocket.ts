"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useTestStore } from "@/store/test-store";
import type { ClientMessage, ServerMessage } from "@/lib/ws-types";

const WS_PORT = 8788;
const WS_URL =
  typeof window !== "undefined"
    ? `ws://${window.location.hostname}:${WS_PORT}`
    : "";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const [error, setError] = useState<string | null>(null);

  const applySnapshot = useTestStore((s) => s.applySnapshot);
  const applyTickUpdate = useTestStore((s) => s.applyTickUpdate);
  const setConnected = useTestStore((s) => s.setConnected);
  const setSendMessage = useTestStore((s) => s.setSendMessage);

  const send = useCallback(
    (msg: ClientMessage) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
      }
    },
    [],
  );

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts.current = 0;
        setError(null);
        setConnected(true);
        setSendMessage((msg: unknown) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
          }
        });
      };

      ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          if (msg.type === "snapshot") {
            applySnapshot(msg.payload);
          } else if (msg.type === "tick") {
            applyTickUpdate(msg.payload);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!unmounted) {
          const delay = Math.min(
            1000 * 2 ** reconnectAttempts.current,
            30_000,
          );
          reconnectAttempts.current += 1;
          setError(
            `Disconnected. Reconnecting in ${Math.round(delay / 1000)}s...`,
          );
          reconnectTimeout.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection failed");
      };
    }

    connect();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [applySnapshot, applyTickUpdate, setConnected, setSendMessage]);

  return { send, error };
}
