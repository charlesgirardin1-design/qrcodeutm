import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ApiError } from "@/lib/api";
import { getStorage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string; variant: string }> };

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_DERIVATIVE_BYTES = 15 * 1024 * 1024;

/**
 * Réception d'un fichier (driver de stockage LOCAL uniquement — avec S3 le
 * navigateur envoie directement au bucket via URL pré-signée).
 * Le corps de la requête est écrit tel quel, en flux, sans aucune
 * transformation : l'original stocké est identique octet pour octet.
 */
export const PUT = withAuth<Ctx>("media:upload", async (request, { params, session }) => {
  const { id, variant } = await params;
  if (!["original", "thumbnail", "preview"].includes(variant)) throw new ApiError(404, "Ressource inconnue.");

  const storage = getStorage();
  if (storage.name !== "local") throw new ApiError(400, "Envoi direct non disponible avec ce stockage.");

  const media = await prisma.media.findUnique({ where: { id } });
  if (!media || media.uploadState !== "PENDING") throw new ApiError(404, "Importation introuvable ou déjà terminée.");
  if (media.uploadedById !== session.userId && session.role !== "ADMIN") throw new ApiError(403, "Accès refusé.");
  if (!request.body) throw new ApiError(400, "Fichier manquant.");

  const key = variant === "original" ? media.storageKey : variant === "thumbnail" ? media.thumbnailKey : media.previewKey;
  if (!key) throw new ApiError(400, "Ce dérivé n'a pas été déclaré.");

  const declared = Number(request.headers.get("content-length") ?? NaN);
  if (variant === "original" && Number.isFinite(declared) && declared !== Number(media.fileSize)) {
    throw new ApiError(400, "La taille du fichier ne correspond pas à celle annoncée.");
  }
  if (variant !== "original") {
    const type = request.headers.get("content-type") ?? "";
    if (!["image/webp", "image/jpeg"].includes(type)) throw new ApiError(415, "Format de miniature invalide.");
    if (Number.isFinite(declared) && declared > MAX_DERIVATIVE_BYTES) throw new ApiError(413, "Miniature trop volumineuse.");
  }

  const info = await storage.put(key, request.body, media.mimeType);

  if (variant === "original") {
    if (info.size !== Number(media.fileSize)) {
      await storage.delete(key);
      throw new ApiError(400, "Le fichier reçu est incomplet. Veuillez réessayer.");
    }
    await prisma.media.update({ where: { id }, data: { checksumSha256: info.checksumSha256 ?? null } });
  } else if (info.size > MAX_DERIVATIVE_BYTES) {
    await storage.delete(key);
    throw new ApiError(413, "Miniature trop volumineuse.");
  }

  return NextResponse.json({ ok: true, size: info.size });
});
