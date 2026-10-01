import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IP = 8;

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function hashIp(ip: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "").update(ip).digest("hex").slice(0, 32);
}

/** Renvoie le nombre de secondes d'attente si l'IP est bloquée, sinon 0. */
export async function loginBlockedFor(ip: string): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MS);
  const failures = await prisma.loginAttempt.findMany({
    where: { ipHash: hashIp(ip), success: false, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (failures.length < MAX_FAILURES_PER_IP) return 0;
  const oldest = failures[failures.length - MAX_FAILURES_PER_IP]!.createdAt.getTime();
  return Math.max(1, Math.ceil((oldest + WINDOW_MS - Date.now()) / 1000));
}

export async function recordLoginAttempt(ip: string, success: boolean) {
  const ipHash = hashIp(ip);
  await prisma.loginAttempt.create({ data: { ipHash, success } });
  if (success) {
    // Une connexion réussie remet le compteur de l'IP à zéro.
    await prisma.loginAttempt.deleteMany({ where: { ipHash, success: false } });
  }
  // Purge opportuniste des anciennes tentatives.
  if (Math.random() < 0.05) {
    await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } });
  }
}
