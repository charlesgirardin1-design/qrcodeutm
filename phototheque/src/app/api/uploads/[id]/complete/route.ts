import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ApiError } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { generateServerDerivatives } from "@/lib/media/thumbnails";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Étape finale : vérifie que l'original est bien présent dans le stockage
 * avec la taille exacte annoncée, contrôle les dérivés (ou les génère côté
 * serveur si possible), puis rend le média visible (READY, statut À TRIER).
 */
export const POST = withAuth<Ctx>("media:upload", async (_request, { params, session }) => {
  const { id } = await params;
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw new ApiError(404, "Importation introuvable.");
  if (media.uploadedById !== session.userId && session.role !== "ADMIN") throw new ApiError(403, "Accès refusé.");
  if (media.uploadState === "READY") return NextResponse.json({ ok: true, mediaId: id });
  if (media.uploadState !== "PENDING") throw new ApiError(409, "Cette importation n'est plus valide.");

  const storage = getStorage();
  const original = await storage.stat(media.storageKey);
  if (!original) throw new ApiError(400, "L'importation a échoué pour ce fichier : original non reçu.");
  if (original.size !== Number(media.fileSize)) {
    await storage.delete(media.storageKey);
    throw new ApiError(400, "L'importation a échoué pour ce fichier : taille reçue incorrecte. Veuillez réessayer.");
  }

  let { thumbnailKey, previewKey, width, height } = media;
  if (thumbnailKey && !(await storage.stat(thumbnailKey))) thumbnailKey = null;
  if (previewKey && !(await storage.stat(previewKey))) previewKey = null;

  if (!thumbnailKey && media.mediaType === "PHOTO") {
    const generated = await generateServerDerivatives(id, media.storageKey, media.mimeType, Number(media.fileSize));
    if (generated) {
      thumbnailKey = generated.thumbnailKey;
      previewKey = generated.previewKey;
      width = width ?? generated.width ?? null;
      height = height ?? generated.height ?? null;
    }
  }

  await prisma.media.update({
    where: { id },
    data: { uploadState: "READY", thumbnailKey, previewKey, width, height, uploadedAt: new Date() },
  });

  // Journal : les importations successives d'une même session sont regroupées.
  const recent = await prisma.auditEvent.findFirst({
    where: { action: "UPLOAD", actorId: session.userId, actorName: session.name, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    await prisma.auditEvent.update({ where: { id: recent.id }, data: { count: { increment: 1 }, details: `${media.categoryName} → ${media.activityName}` } });
  } else {
    await prisma.auditEvent.create({
      data: { action: "UPLOAD", actorId: session.userId, actorName: session.name, role: session.role, details: `${media.categoryName} → ${media.activityName}` },
    });
  }

  return NextResponse.json({ ok: true, mediaId: id });
});
