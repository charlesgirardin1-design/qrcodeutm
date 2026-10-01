import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, readJson, ApiError } from "@/lib/api";
import { uploadInitSchema } from "@/lib/validations";
import { config } from "@/lib/config";
import { detectFormat } from "@/lib/media/formats";
import { derivativeKey, originalKey } from "@/lib/media/keys";
import { resolveCategoryActivity } from "@/lib/media/service";
import { getStorage } from "@/lib/storage";
import { createId } from "@/lib/id";

/**
 * Étape 1 de l'importation : valide le fichier et ses métadonnées, crée
 * l'enregistrement (état PENDING, statut À TRIER) et renvoie les URL vers
 * lesquelles le navigateur envoie les octets BRUTS de l'original — sans
 * recompression ni conversion — puis, séparément, la miniature et l'aperçu.
 */
export const POST = withAuth("media:upload", async (request, { session }) => {
  const input = uploadInitSchema.parse(await readJson(request));

  const format = detectFormat(input.filename, input.mimeType);
  if (!format) throw new ApiError(415, "Ce fichier n'est pas compatible.", "UNSUPPORTED_FORMAT");
  if (input.size > config.maxUploadBytes) {
    throw new ApiError(413, `Ce fichier dépasse la taille maximale autorisée (${Math.round(config.maxUploadBytes / 1024 / 1024)} Mo).`);
  }

  const captureDate = new Date(input.captureDate);
  if (captureDate.getTime() > Date.now() + 24 * 3600 * 1000 || captureDate.getFullYear() < 1990) {
    throw new ApiError(400, "La date de prise de vue est invalide.");
  }

  const { categoryName, activityName } = await resolveCategoryActivity(input.categoryId, input.activityId, true);

  const id = createId();
  const storageKey = originalKey(id, input.filename);
  const thumbnailKey = input.withDerivatives ? derivativeKey(id, "thumbnail", input.derivativeFormat) : null;
  const previewKey = input.withDerivatives ? derivativeKey(id, "preview", input.derivativeFormat) : null;

  await prisma.media.create({
    data: {
      id,
      originalFilename: input.filename,
      extension: format.extension,
      storageKey,
      mimeType: format.mimeType,
      mediaType: format.kind,
      fileSize: BigInt(input.size),
      thumbnailKey,
      previewKey,
      width: input.width,
      height: input.height,
      durationSec: input.durationSec,
      captureDate,
      captureDateSource: input.captureDateSource,
      photographer: input.photographer,
      categoryId: input.categoryId,
      categoryName,
      activityId: input.activityId,
      activityName,
      status: "TO_SORT",
      uploadState: "PENDING",
      uploadedById: session.userId,
      uploadedByName: session.name,
    },
  });

  const storage = getStorage();
  const derivativeMime = input.derivativeFormat === "webp" ? "image/webp" : "image/jpeg";
  const targets = {
    original: await storage.createUploadTarget(storageKey, format.mimeType, id, "original"),
    thumbnail: thumbnailKey ? await storage.createUploadTarget(thumbnailKey, derivativeMime, id, "thumbnail") : null,
    preview: previewKey ? await storage.createUploadTarget(previewKey, derivativeMime, id, "preview") : null,
  };

  return NextResponse.json({ mediaId: id, targets }, { status: 201 });
});
