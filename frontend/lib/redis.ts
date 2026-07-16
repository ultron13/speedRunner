import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redis: Redis | null = null;
let redisAvailable = false;

export function getRedis(): Redis | null {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    // Suppress connection error spam when Redis is unavailable
    redis.on("error", () => {});
  }
  return redis;
}

export async function connectRedis(): Promise<boolean> {
  try {
    const client = getRedis();
    if (!client) return false;

    if (client.status === "connecting" || client.status === "reconnecting") {
      return false;
    }
    if (client.status !== "ready") {
      await client.connect();
    }
    redisAvailable = true;
    return true;
  } catch {
    redisAvailable = false;
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      // Ignore errors during disconnect
    }
    redis = null;
    redisAvailable = false;
  }
}

export async function isRedisConnected(): Promise<boolean> {
  if (!redisAvailable) return false;
  try {
    const client = getRedis();
    if (!client) return false;
    const pong = await client.ping();
    return pong === "PONG";
  } catch {
    redisAvailable = false;
    return false;
  }
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}
