/**
 * Contrat interne entre la route Edge de redirection (`app/[slug]/route.ts`)
 * et les routes API Node.js qui parlent à Prisma (`/api/internal/*`).
 *
 * Prisma Client ne peut pas exécuter de requêtes SQL directement depuis
 * l'Edge Runtime sans Prisma Accelerate / driver adapters. On garde donc la
 * route de redirection 100% Edge + Redis (rapide), et on délègue la lecture
 * "cache miss" ainsi que la persistance des clics à de petites routes Node,
 * appelées en interne et jamais exposées publiquement en dehors du proxy.
 */
export const INTERNAL_API_SECRET_HEADER = "x-internal-api-secret";

export function getInternalApiSecret(): string {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error("INTERNAL_API_SECRET n'est pas défini dans les variables d'environnement.");
  }
  return secret;
}

export function assertInternalRequest(headers: Headers): boolean {
  const provided = headers.get(INTERNAL_API_SECRET_HEADER);
  return Boolean(provided) && provided === process.env.INTERNAL_API_SECRET;
}

export interface ResolvedLink {
  id: string;
  slug: string;
  destinationUrl: string;
  redirectType: "PERMANENT_301" | "TEMPORARY_302";
  isActive: boolean;
  expiresAt: string | null;
}

export interface TrackClickPayload {
  linkId: string;
  ipHash: string;
  userAgent: string | null;
  referrer: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  deviceType: "DESKTOP" | "MOBILE" | "TABLET" | "OTHER";
  os: string | null;
  browser: string | null;
  visitorHash: string;
  isUnique: boolean;
}
