/**
 * Formats acceptés — partagé client/serveur.
 * La détection se fait par extension ET par type MIME (les navigateurs
 * renvoient souvent un type vide pour HEIC/HEIF ou certains MOV).
 */
export type MediaKind = "PHOTO" | "VIDEO";

export const PHOTO_EXTENSIONS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  hif: "image/heif",
  webp: "image/webp",
  gif: "image/gif",
  tif: "image/tiff",
  tiff: "image/tiff",
  bmp: "image/bmp",
  avif: "image/avif",
  // Formats RAW d'appareils photo (conservés tels quels, sans miniature serveur)
  dng: "image/x-adobe-dng",
  cr2: "image/x-canon-cr2",
  cr3: "image/x-canon-cr3",
  nef: "image/x-nikon-nef",
  arw: "image/x-sony-arw",
  orf: "image/x-olympus-orf",
  rw2: "image/x-panasonic-rw2",
  raf: "image/x-fuji-raf",
};

export const VIDEO_EXTENSIONS: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  qt: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  mts: "video/mp2t",
  m2ts: "video/mp2t",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  wmv: "video/x-ms-wmv",
};

export const ACCEPT_ATTRIBUTE = [
  "image/*",
  "video/*",
  ...Object.keys(PHOTO_EXTENSIONS).map((e) => `.${e}`),
  ...Object.keys(VIDEO_EXTENSIONS).map((e) => `.${e}`),
].join(",");

export function fileExtension(filename: string): string {
  const match = /\.([^./\\]+)$/.exec(filename);
  return match ? match[1]!.toLowerCase() : "";
}

export interface DetectedFormat {
  kind: MediaKind;
  mimeType: string;
  extension: string;
}

/** Renvoie le format reconnu, ou null si le fichier n'est pas un média compatible. */
export function detectFormat(filename: string, browserMime?: string | null): DetectedFormat | null {
  const extension = fileExtension(filename);
  const mime = (browserMime || "").toLowerCase();
  if (extension in PHOTO_EXTENSIONS) {
    return { kind: "PHOTO", extension, mimeType: mime.startsWith("image/") ? mime : PHOTO_EXTENSIONS[extension]! };
  }
  if (extension in VIDEO_EXTENSIONS) {
    return { kind: "VIDEO", extension, mimeType: mime.startsWith("video/") ? mime : VIDEO_EXTENSIONS[extension]! };
  }
  // Extension inconnue : on refuse, même si le navigateur annonce image/* ou
  // video/* — l'extension d'origine doit être conservée et identifiable.
  return null;
}

/** Images que les navigateurs savent afficher directement. */
export function isBrowserDisplayableImage(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/bmp"].includes(mimeType);
}

/** Images que `sharp` (prébuild standard) sait décoder pour générer une miniature serveur. */
export function isServerThumbnailable(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/tiff"].includes(mimeType);
}
