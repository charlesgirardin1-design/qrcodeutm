import { randomBytes } from "node:crypto";

/** Identifiant unique, triable approximativement dans le temps, sûr pour une URL. */
export function createId(): string {
  return `m${Date.now().toString(36)}${randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "x")}`;
}
