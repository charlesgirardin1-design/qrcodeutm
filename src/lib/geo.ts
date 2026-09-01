/**
 * Résolution de la géolocalisation IP dans la route de redirection Edge.
 *
 * Sur Vercel, la plateforme enrichit chaque requête Edge avec des en-têtes
 * `x-vercel-ip-*` (pas besoin d'appel réseau supplémentaire, donc aucun coût
 * de latence sur le chemin critique de la redirection). En dehors de Vercel
 * (self-hosted), ces en-têtes sont absents : on retombe sur des valeurs nulles
 * plutôt que de bloquer la redirection avec un appel à un service tiers.
 */
export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function extractGeoFromHeaders(headers: Headers): GeoInfo {
  const lat = headers.get("x-vercel-ip-latitude");
  const lon = headers.get("x-vercel-ip-longitude");

  return {
    country: headers.get("x-vercel-ip-country"),
    region: headers.get("x-vercel-ip-country-region"),
    city: headers.get("x-vercel-ip-city") ? decodeURIComponent(headers.get("x-vercel-ip-city")!) : null,
    latitude: lat ? Number.parseFloat(lat) : null,
    longitude: lon ? Number.parseFloat(lon) : null,
  };
}

export function extractClientIp(headers: Headers): string {
  // x-forwarded-for peut contenir une liste "client, proxy1, proxy2"
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}

/**
 * Hash SHA-256 salé de l'IP (Web Crypto — compatible Edge Runtime).
 * On ne stocke jamais l'IP en clair : seul ce hash est persisté, ce qui
 * satisfait les exigences RGPD de minimisation des données personnelles.
 */
export async function hashIp(ip: string): Promise<string> {
  const salt = process.env.IP_HASH_SALT ?? "linkforge-default-salt";
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashVisitor(ipHash: string, userAgent: string): Promise<string> {
  const data = new TextEncoder().encode(`${ipHash}:${userAgent}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
