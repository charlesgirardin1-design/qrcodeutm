"use client";

import type { Derivatives, ExtractedInfo } from "./media-metadata";

export interface UploadTarget {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export class UploadError extends Error {}

/** PUT brut via XHR (seul moyen fiable d'obtenir la progression d'envoi). */
export function putWithProgress(target: UploadTarget, body: Blob, onProgress?: (loaded: number) => void, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    for (const [key, value] of Object.entries(target.headers)) xhr.setRequestHeader(key, value);
    // Les URL relatives (driver local) portent le cookie de session ; les URL S3 pré-signées non.
    xhr.withCredentials = target.url.startsWith("/");
    xhr.upload.onprogress = (e) => onProgress?.(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = "L'importation a échoué pour ce fichier.";
      try {
        message = JSON.parse(xhr.responseText).error ?? message;
      } catch {
        /* réponse non JSON (S3) */
      }
      reject(new UploadError(message));
    };
    xhr.onerror = () => reject(new UploadError("Connexion interrompue pendant l'envoi."));
    xhr.onabort = () => reject(new UploadError("Envoi annulé."));
    signal?.addEventListener("abort", () => xhr.abort());
    // Le File d'origine est envoyé tel quel : aucun ré-encodage.
    xhr.send(body);
  });
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new UploadError(data.error ?? "L'importation a échoué pour ce fichier.");
  return data as T;
}

export interface UploadMetadata {
  photographer: string;
  categoryId: string;
  activityId: string;
  captureDate: Date;
  captureDateSource: ExtractedInfo["captureDateSource"] | "MANUAL";
}

/**
 * Importation complète d'un fichier :
 *  1. déclaration au serveur (validation + création « À TRIER ») ;
 *  2. envoi de l'ORIGINAL inchangé (progression) ;
 *  3. envoi des dérivés d'affichage s'ils ont pu être générés ;
 *  4. finalisation (vérification de la taille côté serveur).
 */
export async function uploadMedia(
  file: File,
  meta: UploadMetadata,
  derivatives: Derivatives | null,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const init = await api<{ mediaId: string; targets: { original: UploadTarget; thumbnail: UploadTarget | null; preview: UploadTarget | null } }>(
    "/api/uploads",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        captureDate: meta.captureDate.toISOString(),
        captureDateSource: meta.captureDateSource,
        photographer: meta.photographer,
        categoryId: meta.categoryId,
        activityId: meta.activityId,
        withDerivatives: Boolean(derivatives),
        derivativeFormat: derivatives?.format ?? "webp",
        width: derivatives?.width,
        height: derivatives?.height,
        durationSec: derivatives?.durationSec,
      }),
      signal,
    },
  );

  const derivativeBytes = derivatives ? derivatives.thumbnail.size + derivatives.preview.size : 0;
  const total = file.size + derivativeBytes;
  try {
    await putWithProgress(init.targets.original, file, (loaded) => onProgress(Math.min(0.98, loaded / total)), signal);
    if (derivatives && init.targets.thumbnail && init.targets.preview) {
      // Un échec des dérivés n'est pas bloquant : le serveur tentera de les générer.
      await putWithProgress(init.targets.thumbnail, derivatives.thumbnail, undefined, signal).catch(() => undefined);
      await putWithProgress(init.targets.preview, derivatives.preview, undefined, signal).catch(() => undefined);
    }
    await api(`/api/uploads/${init.mediaId}/complete`, { method: "POST", signal });
    onProgress(1);
    return init.mediaId;
  } catch (error) {
    // Nettoyage de l'importation inachevée (fichier partiel + enregistrement).
    fetch(`/api/uploads/${init.mediaId}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}
