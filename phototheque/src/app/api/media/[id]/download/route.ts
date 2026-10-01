import { prisma } from "@/lib/prisma";
import { withAuth, ApiError } from "@/lib/api";
import { serveObject } from "@/lib/media/stream";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Téléchargement de l'ORIGINAL (ADMIN) : fichier stocké à l'identique, nom et
 * extension d'origine (ex. IMG_1234.JPG, photo.HEIC, video.MOV).
 */
export const GET = withAuth<Ctx>("media:download", async (request, { params }) => {
  const { id } = await params;
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media || media.uploadState !== "READY") throw new ApiError(404, "Ce média n'existe plus.");
  return serveObject(request, {
    key: media.storageKey,
    contentType: media.mimeType,
    filename: media.originalFilename,
    disposition: "attachment",
    cache: "private",
  });
});
