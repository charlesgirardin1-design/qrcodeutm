"use client";

/**
 * Lecture des métadonnées et génération des dérivés d'affichage DANS LE
 * NAVIGATEUR. Le fichier original n'est jamais modifié : on le lit
 * seulement (EXIF, décodage d'une copie en mémoire pour dessiner une
 * miniature sur un canvas). Les octets envoyés au serveur sont ceux du
 * `File` d'origine, inchangés.
 */

export type DateSource = "EXIF" | "VIDEO_METADATA" | "FILE_DATE";

export interface ExtractedInfo {
  captureDate: Date;
  captureDateSource: DateSource;
  width?: number;
  height?: number;
  durationSec?: number;
}

export interface Derivatives {
  thumbnail: Blob;
  preview: Blob;
  format: "webp" | "jpg";
  width: number;
  height: number;
  durationSec?: number;
}

const THUMB_SIZE = 480;
const PREVIEW_SIZE = 1920;

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

async function readExifDate(file: File): Promise<Date | null> {
  try {
    const exifr = (await import("exifr")).default;
    const data = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate", "DateTimeDigitized", "ModifyDate"],
      reviveValues: true,
    });
    const value = data?.DateTimeOriginal ?? data?.CreateDate ?? data?.DateTimeDigitized;
    return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Date de création d'une vidéo MP4/MOV : champ `creation_time` de l'atome
 * `mvhd` (secondes depuis 1904, UTC). Lecture par tranches, sans charger le
 * fichier entier.
 */
async function readQuickTimeDate(file: File): Promise<Date | null> {
  const readSlice = async (start: number, length: number) =>
    new DataView(await file.slice(start, Math.min(start + length, file.size)).arrayBuffer());

  async function findBox(start: number, end: number, type: string): Promise<{ start: number; size: number; header: number } | null> {
    let offset = start;
    let guard = 0;
    while (offset + 8 <= end && guard++ < 10000) {
      const view = await readSlice(offset, 16);
      if (view.byteLength < 8) return null;
      let size = view.getUint32(0);
      const name = String.fromCharCode(view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7));
      let header = 8;
      if (size === 1 && view.byteLength >= 16) {
        size = Number(view.getBigUint64(8));
        header = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      if (size < header) return null;
      if (name === type) return { start: offset, size, header };
      offset += size;
    }
    return null;
  }

  try {
    const moov = await findBox(0, file.size, "moov");
    if (!moov) return null;
    const mvhd = await findBox(moov.start + moov.header, moov.start + moov.size, "mvhd");
    if (!mvhd) return null;
    const view = await readSlice(mvhd.start + mvhd.header, 20);
    const version = view.getUint8(0);
    const seconds = version === 1 ? Number(view.getBigUint64(4)) : view.getUint32(4);
    if (!seconds) return null;
    const date = new Date((seconds - 2082844800) * 1000);
    return date.getFullYear() > 1990 && date.getTime() < Date.now() + 86400000 ? date : null;
  } catch {
    return null;
  }
}

export async function extractInfo(file: File, kind: "PHOTO" | "VIDEO"): Promise<ExtractedInfo> {
  if (kind === "PHOTO") {
    const exif = await readExifDate(file);
    if (exif) return { captureDate: exif, captureDateSource: "EXIF" };
  } else {
    const qt = await readQuickTimeDate(file);
    if (qt) return { captureDate: qt, captureDateSource: "VIDEO_METADATA" };
  }
  return { captureDate: new Date(file.lastModified || Date.now()), captureDateSource: "FILE_DATE" };
}

// ---------------------------------------------------------------------------
// Miniatures (copie décodée → canvas → WebP/JPEG). L'original reste intact.
// ---------------------------------------------------------------------------

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<{ blob: Blob; format: "webp" | "jpg" }> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Encodage impossible"));
        if (blob.type === "image/webp") return resolve({ blob, format: "webp" });
        // Navigateur sans encodeur WebP : repli JPEG.
        canvas.toBlob((jpeg) => (jpeg ? resolve({ blob: jpeg, format: "jpg" }) : reject(new Error("Encodage impossible"))), "image/jpeg", quality);
      },
      "image/webp",
      quality,
    );
  });
}

async function renderVariants(source: CanvasImageSource, width: number, height: number) {
  const render = async (max: number, quality: number, forceJpeg?: boolean) => {
    const scale = Math.min(1, max / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponible");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    if (forceJpeg) {
      return new Promise<{ blob: Blob; format: "webp" | "jpg" }>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve({ blob: b, format: "jpg" }) : reject(new Error("Encodage impossible"))), "image/jpeg", quality),
      );
    }
    return canvasToBlob(canvas, quality);
  };
  const thumb = await render(THUMB_SIZE, 0.78);
  // Même format pour les deux dérivés (une seule extension déclarée au serveur).
  const preview = await render(PREVIEW_SIZE, 0.85, thumb.format === "jpg");
  return { thumbnail: thumb.blob, preview: preview.blob, format: thumb.format };
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible par le navigateur"));
    };
    img.src = url;
  });
}

const HEIC = /\.(heic|heif|hif)$/i;

async function photoDerivatives(file: File): Promise<Derivatives | null> {
  let decodable: Blob = file;
  let img: HTMLImageElement | null = null;
  try {
    img = await loadImage(file); // Safari décode nativement le HEIC
  } catch {
    if (HEIC.test(file.name) || /hei[cf]/i.test(file.type)) {
      try {
        // Conversion d'une COPIE en JPEG, uniquement pour fabriquer la miniature.
        const heic2any = (await import("heic2any")).default;
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
        decodable = Array.isArray(converted) ? converted[0]! : converted;
        img = await loadImage(decodable);
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }
  try {
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return null;
    const variants = await renderVariants(img, width, height);
    return { ...variants, width, height };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

async function videoDerivatives(file: File): Promise<Derivatives | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 15000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Vidéo illisible"));
      };
    });
    const duration = Number.isFinite(video.duration) ? video.duration : undefined;
    const target = duration ? Math.min(1, duration / 10) : 0;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 15000);
      video.onseeked = () => {
        clearTimeout(timer);
        resolve();
      };
      video.currentTime = target || 0.01;
    });
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;
    const variants = await renderVariants(video, width, height);
    return { ...variants, width, height, durationSec: duration };
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** Génère miniature + aperçu ; renvoie null si le navigateur ne sait pas décoder le média. */
export async function createDerivatives(file: File, kind: "PHOTO" | "VIDEO"): Promise<Derivatives | null> {
  return kind === "PHOTO" ? photoDerivatives(file) : videoDerivatives(file);
}
