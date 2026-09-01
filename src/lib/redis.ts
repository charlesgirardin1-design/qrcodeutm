import { Redis } from "@upstash/redis";

/**
 * Client Redis (Upstash, REST-based) — compatible Edge Runtime.
 * Utilisé pour :
 *  - le cache de résolution slug -> lien (évite un aller-retour Postgres à chaque redirection)
 *  - le comptage de clics ultra-rapide (compteurs atomiques, avant persistance en base)
 *  - la déduplication de visiteurs uniques sur une fenêtre glissante (24h)
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

export const cacheKeys = {
  linkBySlug: (slug: string) => `link:slug:${slug}`,
  clickCounter: (linkId: string) => `link:clicks:total:${linkId}`,
  uniqueVisitor: (linkId: string, visitorHash: string) => `link:unique:${linkId}:${visitorHash}`,
};

/** TTL du cache de résolution de slug (secondes). Invalidé explicitement à la mise à jour du lien. */
export const SLUG_CACHE_TTL_SECONDS = 60 * 60; // 1h

/** Fenêtre de déduplication "visiteur unique" (secondes). */
export const UNIQUE_VISITOR_WINDOW_SECONDS = 60 * 60 * 24; // 24h
