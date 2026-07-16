// Prisma client - lazy loaded to avoid build-time issues
import { PrismaClient } from "@prisma/client";

let _prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (_prisma) return _prisma;
  
  // During build time, return a mock
  if (typeof window === "undefined" && !process.env.DATABASE_URL) {
    return {} as PrismaClient;
  }

  try {
    const client = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
    });
    _prisma = client;
    return client;
  } catch (e) {
    console.error("Failed to initialize Prisma:", e);
    return {} as PrismaClient;
  }
}

// For backwards compatibility - use a type-safe proxy

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    const client = getPrisma();
    const value = client[prop as keyof PrismaClient];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
