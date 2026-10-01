import { prisma } from "@/lib/prisma";
import { withAuth, ApiError } from "@/lib/api";
import { serveObject } from "@/lib/media/stream";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Affichage (ADMIN) : miniature, aperçu ou original inline (lecture vidéo).
 * Les photos de la photothèque ne sont jamais publiques : chaque accès est
 * authentifié et autorisé.
 */
export const GET = withAuth<Ctx>("media:read", async (request, { params }) => {
  const { id } = await params;
  const variant = new URL(request.url).searchParams.get("variant") ?? "thumbnail";
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media || media.uploadState !== "READY") throw new ApiError(404, "Ce média n'existe plus.");

  if (variant === "original") {
    return serveObject(request, {
      key: media.storageKey,
      contentType: media.mimeType,
      filename: media.originalFilename,
      disposition: "inline",
      cache: "private",
    });
  }

  const key = variant === "preview" ? (media.previewKey ?? media.thumbnailKey) : media.thumbnailKey;
  if (!key) throw new ApiError(404, "Aucune miniature disponible pour ce média.");
  return serveObject(request, {
    key,
    contentType: key.endsWith(".webp") ? "image/webp" : "image/jpeg",
    filename: `${variant}-${media.id}.${key.split(".").pop()}`,
    disposition: "inline",
    cache: "immutable",
  });
});
