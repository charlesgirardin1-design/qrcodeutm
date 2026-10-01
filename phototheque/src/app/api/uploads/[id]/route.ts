import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { getStorage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** Annulation d'une importation inachevée (PENDING) par son auteur : nettoie fichiers et enregistrement. */
export const DELETE = withAuth<Ctx>("media:upload", async (_request, { params, session }) => {
  const { id } = await params;
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media || media.uploadState !== "PENDING") return NextResponse.json({ ok: true });
  if (media.uploadedById !== session.userId && session.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  const storage = getStorage();
  for (const key of [media.thumbnailKey, media.previewKey, media.storageKey]) {
    if (key) await storage.delete(key).catch(() => undefined);
  }
  await prisma.media.delete({ where: { id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
});
