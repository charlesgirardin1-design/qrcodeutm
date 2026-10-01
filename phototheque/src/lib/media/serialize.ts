import type { Media } from "@prisma/client";

/** Représentation JSON d'un média envoyée au client (pas de clé de stockage). */
export interface MediaDTO {
  id: string;
  originalFilename: string;
  extension: string;
  mimeType: string;
  mediaType: "PHOTO" | "VIDEO";
  fileSize: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  captureDate: string;
  captureDateSource: string;
  uploadedAt: string;
  photographer: string;
  categoryId: string | null;
  categoryName: string;
  activityId: string | null;
  activityName: string;
  status: "TO_SORT" | "SORTED";
  sortedAt: string | null;
  sortedByName: string | null;
  uploadedByName: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  /** URL d'affichage inline de l'original (lecture vidéo / image en grand) */
  originalUrl: string;
  /** URL de TÉLÉCHARGEMENT de l'original (Content-Disposition: attachment) */
  downloadUrl: string;
}

function version(key: string | null) {
  if (!key) return "";
  const last = key.split("/").pop() ?? "";
  return encodeURIComponent(last.replace(/\.[a-z]+$/, ""));
}

export function serializeMedia(media: Media): MediaDTO {
  return {
    id: media.id,
    originalFilename: media.originalFilename,
    extension: media.extension,
    mimeType: media.mimeType,
    mediaType: media.mediaType,
    fileSize: Number(media.fileSize),
    width: media.width,
    height: media.height,
    durationSec: media.durationSec,
    captureDate: media.captureDate.toISOString(),
    captureDateSource: media.captureDateSource,
    uploadedAt: media.uploadedAt.toISOString(),
    photographer: media.photographer,
    categoryId: media.categoryId,
    categoryName: media.categoryName,
    activityId: media.activityId,
    activityName: media.activityName,
    status: media.status,
    sortedAt: media.sortedAt?.toISOString() ?? null,
    sortedByName: media.sortedByName,
    uploadedByName: media.uploadedByName,
    thumbnailUrl: media.thumbnailKey ? `/api/media/${media.id}/file?variant=thumbnail&v=${version(media.thumbnailKey)}` : null,
    previewUrl: media.previewKey ? `/api/media/${media.id}/file?variant=preview&v=${version(media.previewKey)}` : null,
    originalUrl: `/api/media/${media.id}/file?variant=original`,
    downloadUrl: `/api/media/${media.id}/download`,
  };
}
