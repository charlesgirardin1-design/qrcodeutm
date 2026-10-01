import "server-only";

/** Nettoie un nom de fichier pour la clé de stockage SANS toucher à l'extension. */
function safeName(filename: string): string {
  const base = filename.normalize("NFC").replace(/[\\/]/g, "_");
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : ""; // casse conservée : IMG_1234.JPG reste .JPG
  const cleanStem =
    stem
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) || "fichier";
  const cleanExt = ext.replace(/[^A-Za-z0-9.]/g, "");
  return `${cleanStem}${cleanExt}`;
}

/** originals/AAAA/MM/<mediaId>/<nom-original.EXT> */
export function originalKey(mediaId: string, filename: string, date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `originals/${yyyy}/${mm}/${mediaId}/${safeName(filename)}`;
}

/** derivatives/<mediaId>/<variant>-<version>.<ext> — séparés des originaux. */
export function derivativeKey(mediaId: string, variant: "thumbnail" | "preview", extension: "webp" | "jpg") {
  return `derivatives/${mediaId}/${variant}-${Date.now().toString(36)}.${extension}`;
}
