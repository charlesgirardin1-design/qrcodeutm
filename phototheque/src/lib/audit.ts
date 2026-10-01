import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/auth/session";

type Db = PrismaClient | Prisma.TransactionClient;

export async function audit(
  session: Session,
  action: string,
  details?: string,
  count = 1,
  db: Db = prisma,
) {
  try {
    await db.auditEvent.create({
      data: { action, details, count, actorId: session.userId, actorName: session.name, role: session.role },
    });
  } catch (error) {
    // Le journal ne doit jamais faire échouer l'action principale.
    console.error("[audit]", error);
  }
}
