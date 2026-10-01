import "server-only";
import { createLocalDriver } from "./local";
import { createS3Driver } from "./s3";
import type { StorageDriver } from "./types";

export * from "./types";

let driver: StorageDriver | null = null;

/** Driver de stockage configuré (STORAGE_DRIVER = "local" | "s3"). */
export function getStorage(): StorageDriver {
  if (!driver) {
    const kind = process.env.STORAGE_DRIVER || "local";
    driver = kind === "s3" ? createS3Driver() : createLocalDriver(process.env.LOCAL_STORAGE_DIR || "./storage");
  }
  return driver;
}

/** En-tête Content-Disposition compatible avec les noms accentués. */
export function contentDispositionHeader(disposition: "inline" | "attachment", filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
