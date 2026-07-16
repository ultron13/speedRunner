// Prisma client - lazy loaded to avoid build-time issues
import type { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (_prisma) return _prisma;
  
  // During build time, return a mock
  if (typeof window === "undefined" && !process.env.DATABASE_URL) {
    return {} as PrismaClient;
  }

  try {
    // Dynamic import to avoid build issues
    const { PrismaClient: PC } = require("@prisma/client");
    const client = new PC({
      log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
    });
    _prisma = client;
    return client;
  } catch (e) {
    console.error("Failed to initialize Prisma:", e);
    return {} as PrismaClient;
  }
}

// For backwards compatibility
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return (getPrisma() as any)[prop];
  },
});
