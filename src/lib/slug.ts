import { customAlphabet } from "nanoid";

// Alphabet sans caractères ambigus (0/O, 1/l/I) pour des slugs lisibles à l'oral/à l'écrit.
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const SLUG_LENGTH = 7;

const generate = customAlphabet(ALPHABET, SLUG_LENGTH);

export function generateSlug(): string {
  return generate();
}

const CUSTOM_SLUG_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

export function isValidCustomSlug(slug: string): boolean {
  return CUSTOM_SLUG_REGEX.test(slug);
}

// Slugs interdits car ils entreraient en conflit avec les routes applicatives.
export const RESERVED_SLUGS = new Set([
  "api",
  "dashboard",
  "login",
  "register",
  "logout",
  "links",
  "presets",
  "qr-studio",
  "settings",
  "_next",
  "favicon.ico",
]);
