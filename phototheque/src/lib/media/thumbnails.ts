import "server-only";
import { getStorage } from "@/lib/storage";
import { derivativeKey } from "./keys";
import { isServerThumbnailable } from "./formats";

const THUMB_SIZE = 480;
const PREVIEW_SIZE = 1920;

/**
 * Génère miniature + aperçu côté serveur à partir d'une COPIE en mémoire de
 * l'original. L'original n'est jamais réécrit : seuls de nouveaux objets
 * `derivatives/...` sont créés. Utilisé quand le navigateur n'a pas pu
 * produire les dérivés lui-même.
 */
export async function generateServerDerivatives(
  mediaId: string,
  storageKey: string,
  mimeType: string,
  fileSize: number,
): Promise<{ thumbnailKey: string; previewKey: string; width?: number; height?: number } | null> {
  if (!isServerThumbnailable(mimeType)) return null;
  if (fileSize > 200 * 1024 * 1024) return null; // garde-fou mémoire
  try {
    const sharp = (await import("sharp")).default;
    const storage = getStorage();
    const input = await storage.readBuffer(storageKey);
    const image = sharp(input, { failOn: "none", limitInputPixels: 300_000_000 }).rotate();
    const meta = await image.metadata();

    const thumb = await image.clone().resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    const preview = await image.clone().resize(PREVIEW_SIZE, PREVIEW_SIZE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();

    const thumbnailKey = derivativeKey(mediaId, "thumbnail", "webp");
    const previewKey = derivativeKey(mediaId, "preview", "webp");
    await storage.put(thumbnailKey, thumb, "image/webp");
    await storage.put(previewKey, preview, "image/webp");

    const rotated = (meta.orientation ?? 1) >= 5;
    return {
      thumbnailKey,
      previewKey,
      width: rotated ? meta.height : meta.width,
      height: rotated ? meta.width : meta.height,
    };
  } catch (error) {
    console.warn(`[thumbnails] génération serveur impossible pour ${mediaId}:`, error);
    return null;
  }
}
