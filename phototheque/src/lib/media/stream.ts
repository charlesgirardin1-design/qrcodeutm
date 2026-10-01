import "server-only";
import { contentDispositionHeader, getStorage, StorageNotFoundError } from "@/lib/storage";
import { ApiError } from "@/lib/api";

/**
 * Diffuse un objet du stockage :
 *  - S3 : redirection vers une URL pré-signée de courte durée ;
 *  - local : flux depuis le disque, avec prise en charge des requêtes
 *    `Range` (indispensable pour la lecture/avance rapide des vidéos).
 * Les octets sont transmis tels quels (aucune transformation).
 */
export async function serveObject(
  request: Request,
  opts: {
    key: string;
    contentType: string;
    filename: string;
    disposition: "inline" | "attachment";
    cache: "immutable" | "private";
  },
): Promise<Response> {
  const storage = getStorage();

  const signed = await storage.signedReadUrl(opts.key, {
    filename: opts.filename,
    disposition: opts.disposition,
    contentType: opts.contentType,
  });
  if (signed) {
    return new Response(null, {
      status: 302,
      headers: { Location: signed, "Cache-Control": "private, max-age=1800" },
    });
  }

  const info = await storage.stat(opts.key);
  if (!info) throw new ApiError(404, "Le fichier est introuvable dans le stockage.");

  const headers = new Headers({
    "Content-Type": opts.contentType,
    "Content-Disposition": contentDispositionHeader(opts.disposition, opts.filename),
    "Accept-Ranges": "bytes",
    "Cache-Control": opts.cache === "immutable" ? "private, max-age=31536000, immutable" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });

  const range = request.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  try {
    if (match && (match[1] || match[2])) {
      let start: number;
      let end: number;
      if (match[1]) {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
      } else {
        const suffix = Number(match[2]);
        start = Math.max(0, info.size - suffix);
        end = info.size - 1;
      }
      if (start > end || start >= info.size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
      headers.set("Content-Length", String(end - start + 1));
      const body = await storage.read(opts.key, { range: { start, end } });
      return new Response(body, { status: 206, headers });
    }

    headers.set("Content-Length", String(info.size));
    const body = await storage.read(opts.key);
    return new Response(body, { status: 200, headers });
  } catch (error) {
    if (error instanceof StorageNotFoundError) throw new ApiError(404, "Le fichier est introuvable dans le stockage.");
    throw error;
  }
}
