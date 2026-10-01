import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { deleteMediaPermanently } from "@/lib/media/service";
import { audit } from "@/lib/audit";

const STALE_PENDING_MS = 24 * 3600 * 1000;

/** État de maintenance : importations interrompues et suppressions inachevées. */
export const GET = withAuth("settings:manage", async () => {
  const [stalePending, deleting] = await Promise.all([
    prisma.media.count({ where: { uploadState: "PENDING", uploadedAt: { lt: new Date(Date.now() - STALE_PENDING_MS) } } }),
    prisma.media.count({ where: { uploadState: "DELETING" } }),
  ]);
  return NextResponse.json({ stalePending, deleting, storage: getStorage().name });
});

/**
 * Nettoyage : supprime les importations interrompues depuis plus de 24 h
 * (fichiers partiels + enregistrements) et relance les suppressions
 * inachevées. Opérations idempotentes.
 */
export const POST = withAuth("settings:manage", async (_request, { session }) => {
  const candidates = await prisma.media.findMany({
    where: {
      OR: [{ uploadState: "DELETING" }, { uploadState: "PENDING", uploadedAt: { lt: new Date(Date.now() - STALE_PENDING_MS) } }],
    },
    select: { id: true },
    take: 500,
  });
  let cleaned = 0;
  let failed = 0;
  for (const { id } of candidates) {
    const result = await deleteMediaPermanently(id);
    if (result.ok) cleaned++;
    else failed++;
  }
  if (cleaned) await audit(session, "MAINTENANCE", `${cleaned} élément(s) nettoyé(s)`, cleaned);
  return NextResponse.json({ cleaned, failed });
});
