import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { redis, cacheKeys, SLUG_CACHE_TTL_SECONDS, UNIQUE_VISITOR_WINDOW_SECONDS } from "@/lib/redis";
import { extractClientIp, extractGeoFromHeaders, hashIp, hashVisitor } from "@/lib/geo";
import { parseUserAgent } from "@/lib/ua";
import { INTERNAL_API_SECRET_HEADER, getInternalApiSecret, type ResolvedLink, type TrackClickPayload } from "@/lib/internal-api";

// Edge Runtime : la redirection doit rester sur le chemin le plus court possible.
// Aucune requête Postgres synchrone ici — uniquement Redis (REST, edge-friendly)
// et, en dernier recours (cache miss), un aller-retour vers une route Node interne.
export const runtime = "edge";

const NOT_FOUND_HTML = (message: string) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Lien introuvable</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font:16px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0f11;color:#f4f4f5}main{text-align:center;max-width:28rem;padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#a1a1aa}</style>
</head><body><main><h1>🔗 ${message}</h1><p>Vérifiez le lien ou contactez la personne qui vous l'a partagé.</p></main></body></html>`;

async function resolveLink(slug: string, origin: string): Promise<ResolvedLink | null> {
  const cached = await redis.get<string | ResolvedLink>(cacheKeys.linkBySlug(slug));
  if (cached) {
    return typeof cached === "string" ? (JSON.parse(cached) as ResolvedLink) : cached;
  }

  // Cache miss : on interroge la route Node interne (Prisma), qui réchauffe
  // elle-même le cache Redis pour les requêtes suivantes sur ce slug.
  const resolveUrl = `${origin}/api/internal/resolve/${slug}`;

  try {
    const res = await fetch(resolveUrl, {
      headers: { [INTERNAL_API_SECRET_HEADER]: getInternalApiSecret() },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { link: ResolvedLink | null };
    return data.link;
  } catch {
    return null;
  }
}

async function trackClickInBackground(request: NextRequest, link: ResolvedLink, origin: string) {
  const headers = request.headers;
  const ip = extractClientIp(headers);
  const userAgent = headers.get("user-agent");
  const referrer = headers.get("referer");
  const geo = extractGeoFromHeaders(headers);
  const { deviceType, os, browser } = parseUserAgent(userAgent);

  const ipHash = await hashIp(ip);
  const visitorHash = await hashVisitor(ipHash, userAgent ?? "unknown");

  // Déduplication "visiteur unique" sur une fenêtre glissante de 24h via SETNX.
  const uniqueKey = cacheKeys.uniqueVisitor(link.id, visitorHash);
  const wasSet = await redis.set(uniqueKey, 1, { nx: true, ex: UNIQUE_VISITOR_WINDOW_SECONDS });
  const isUnique = wasSet !== null;

  // Compteur temps réel (affiché instantanément dans le dashboard sans attendre Postgres).
  await redis.incr(cacheKeys.clickCounter(link.id)).catch(() => undefined);

  const payload: TrackClickPayload = {
    linkId: link.id,
    ipHash,
    userAgent,
    referrer,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    latitude: geo.latitude,
    longitude: geo.longitude,
    deviceType,
    os,
    browser,
    visitorHash,
    isUnique,
  };

  const trackUrl = `${origin}/api/internal/track`;

  await fetch(trackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", [INTERNAL_API_SECRET_HEADER]: getInternalApiSecret() },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const origin = new URL(request.url).origin;

  const link = await resolveLink(slug, origin);

  if (!link) {
    return new NextResponse(NOT_FOUND_HTML("Ce lien n'existe pas"), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (!link.isActive) {
    return new NextResponse(NOT_FOUND_HTML("Ce lien a été désactivé"), {
      status: 410,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
    return new NextResponse(NOT_FOUND_HTML("Ce lien a expiré"), {
      status: 410,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const status = link.redirectType === "PERMANENT_301" ? 301 : 302;
  const response = NextResponse.redirect(link.destinationUrl, status);

  // Planifie l'enregistrement du clic APRÈS l'envoi de la réponse de redirection :
  // l'utilisateur ne subit aucune latence liée au tracking analytics.
  after(() => trackClickInBackground(request, link, origin));

  return response;
}
