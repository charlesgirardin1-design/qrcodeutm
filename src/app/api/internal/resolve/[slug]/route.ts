import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, cacheKeys, SLUG_CACHE_TTL_SECONDS } from "@/lib/redis";
import { assertInternalRequest, type ResolvedLink } from "@/lib/internal-api";

// Runtime Node.js (par défaut) : seule route autorisée à parler à Prisma
// pour la résolution de slug — appelée uniquement en cas de cache miss Redis
// depuis la route Edge de redirection.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!assertInternalRequest(request.headers)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const link = await prisma.link.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      destinationUrl: true,
      redirectType: true,
      isActive: true,
      expiresAt: true,
    },
  });

  if (!link) {
    return NextResponse.json({ link: null }, { status: 404 });
  }

  const resolved: ResolvedLink = {
    id: link.id,
    slug: link.slug,
    destinationUrl: link.destinationUrl,
    redirectType: link.redirectType,
    isActive: link.isActive,
    expiresAt: link.expiresAt?.toISOString() ?? null,
  };

  // Réchauffe le cache pour les prochaines résolutions.
  await redis
    .set(cacheKeys.linkBySlug(link.slug), JSON.stringify(resolved), { ex: SLUG_CACHE_TTL_SECONDS })
    .catch(() => undefined);

  return NextResponse.json({ link: resolved });
}
