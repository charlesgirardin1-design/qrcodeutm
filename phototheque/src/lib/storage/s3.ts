import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageNotFoundError, type StorageDriver } from "./types";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

function isNotFound(error: unknown) {
  return (
    error instanceof S3ServiceException &&
    (error.name === "NotFound" || error.name === "NoSuchKey" || error.$metadata.httpStatusCode === 404)
  );
}

function contentDisposition(disposition: "inline" | "attachment", filename?: string) {
  if (!filename) return disposition;
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Stockage objet compatible S3. Les originaux sont envoyés directement par
 * le navigateur via une URL PUT pré-signée (aucun passage par le serveur,
 * aucune limite de taille de requête de la plateforme d'hébergement).
 */
export function createS3Driver(): StorageDriver {
  const bucket = required("S3_BUCKET");
  const client = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    },
    // Les navigateurs ne savent pas calculer les sommes de contrôle CRC
    // ajoutées par défaut aux URL pré-signées des SDK récents.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  // Les URL de lecture sont signées sur une fenêtre horaire fixe : l'URL est
  // identique pendant une heure, ce qui permet au navigateur de mettre les
  // miniatures en cache.
  function stableSigningDate() {
    const hour = 3600 * 1000;
    return new Date(Math.floor(Date.now() / hour) * hour);
  }

  return {
    name: "s3",

    async createUploadTarget(key, contentType) {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
        { expiresIn: 6 * 3600 },
      );
      return { url, method: "PUT", headers: { "Content-Type": contentType } };
    },

    async put(key, body, contentType) {
      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(await new Response(body).arrayBuffer());
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
      return { size: buffer.length };
    },

    async stat(key) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { size: Number(head.ContentLength ?? 0) };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async read(key, options) {
      try {
        const result = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            Range: options?.range ? `bytes=${options.range.start}-${options.range.end}` : undefined,
          }),
        );
        if (!result.Body) throw new StorageNotFoundError(key);
        return result.Body.transformToWebStream() as ReadableStream<Uint8Array>;
      } catch (error) {
        if (isNotFound(error)) throw new StorageNotFoundError(key);
        throw error;
      }
    },

    async readBuffer(key) {
      const stream = await this.read(key);
      return Buffer.from(await new Response(stream).arrayBuffer());
    },

    async signedReadUrl(key, { filename, disposition, contentType }) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentDisposition: contentDisposition(disposition, filename),
          ResponseContentType: contentType,
        }),
        { expiresIn: 2 * 3600, signingDate: stableSigningDate() },
      );
    },

    async delete(key) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },
  };
}
