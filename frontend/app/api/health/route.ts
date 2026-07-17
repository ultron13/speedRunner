import { NextResponse } from "next/server";

import { connectRedis, isRedisConnected } from "@/lib/redis";

/**
 * Liveness/readiness endpoint for Kubernetes.
 * Always returns HTTP 200 when the process is up so probes succeed.
 * Redis status is reported as healthy vs degraded without failing the probe.
 */
export async function GET() {
  // Best-effort connect so first probe after boot can discover Redis.
  if (!(await isRedisConnected())) {
    await connectRedis().catch(() => false);
  }
  const redisOk = await isRedisConnected();

  const health = {
    status: redisOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      redis: redisOk ? "connected" : "disconnected",
      app: "running",
    },
    version: process.env.npm_package_version || "0.1.0",
  };

  return NextResponse.json(health, { status: 200 });
}
