import { NextResponse } from "next/server";

import { isRedisConnected } from "@/lib/redis";

export async function GET() {
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

  return NextResponse.json(health, {
    status: redisOk ? 200 : 503,
  });
}
