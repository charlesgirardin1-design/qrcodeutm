import "server-only";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, rmdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { StorageNotFoundError, type StorageDriver } from "./types";

/**
 * Stockage sur disque. Les fichiers sont écrits dans un fichier temporaire
 * puis renommés atomiquement : un original n'est jamais visible à moitié écrit.
 */
export function createLocalDriver(rootDir: string): StorageDriver {
  const root = path.resolve(rootDir);

  function resolveKey(key: string): string {
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Clé de stockage invalide.");
    return full;
  }

  async function writeStream(key: string, body: Buffer | ReadableStream<Uint8Array>) {
    const target = resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.${Date.now()}.part`;
    const hash = createHash("sha256");
    let size = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        hash.update(chunk);
        size += chunk.length;
        cb(null, chunk);
      },
    });
    const source = Buffer.isBuffer(body)
      ? Readable.from([body])
      : Readable.fromWeb(body as import("node:stream/web").ReadableStream<Uint8Array>);
    try {
      await pipeline(source, meter, createWriteStream(tmp, { flags: "wx" }));
      await rename(tmp, target);
    } catch (error) {
      await rm(tmp, { force: true });
      throw error;
    }
    return { size, checksumSha256: hash.digest("hex") };
  }

  return {
    name: "local",

    async createUploadTarget(_key, contentType, mediaId, variant) {
      // Le navigateur envoie le fichier à notre API, qui l'écrit tel quel.
      return {
        url: `/api/uploads/${mediaId}/${variant}`,
        method: "PUT",
        headers: { "Content-Type": contentType || "application/octet-stream" },
      };
    },

    async put(key, body) {
      return writeStream(key, body);
    },

    async stat(key) {
      try {
        const info = await stat(resolveKey(key));
        return info.isFile() ? { size: info.size } : null;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },

    async read(key, options) {
      const file = resolveKey(key);
      try {
        await stat(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StorageNotFoundError(key);
        throw error;
      }
      const stream = createReadStream(file, options?.range ? { start: options.range.start, end: options.range.end } : {});
      return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
    },

    async readBuffer(key) {
      try {
        return await readFile(resolveKey(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StorageNotFoundError(key);
        throw error;
      }
    },

    async signedReadUrl() {
      return null;
    },

    async delete(key) {
      try {
        await unlink(resolveKey(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      // Nettoie les dossiers vides laissés derrière (sans erreur s'ils ne le sont pas).
      let dir = path.dirname(resolveKey(key));
      while (dir.startsWith(root + path.sep)) {
        try {
          await rmdir(dir);
        } catch {
          break;
        }
        dir = path.dirname(dir);
      }
    },
  };
}
