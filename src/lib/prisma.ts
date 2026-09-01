import { PrismaClient } from "@prisma/client";

// Évite l'épuisement des connexions en dev (hot-reload de Next.js) en
// réutilisant une seule instance de PrismaClient à travers le globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
