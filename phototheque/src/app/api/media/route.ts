import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { buildMediaOrderBy, buildMediaWhere } from "@/lib/media/filters";
import { serializeMedia } from "@/lib/media/serialize";

const MAX_PAGE = 120;

/**
 * Photothèque (ADMIN) : liste paginée par curseur (défilement infini),
 * filtrée, recherchée et triée côté base de données. Ne renvoie que des
 * métadonnées + URL de miniatures — jamais les originaux.
 */
export const GET = withAuth("media:read", async (request) => {
  const params = new URL(request.url).searchParams;
  const where = buildMediaWhere(params);
  const orderBy = buildMediaOrderBy(params.get("sort"));
  const limit = Math.min(Math.max(Number(params.get("limit")) || 60, 1), MAX_PAGE);
  const cursor = params.get("cursor");

  const [items, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    cursor ? Promise.resolve(null) : prisma.media.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return NextResponse.json({
    items: page.map(serializeMedia),
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
    total,
  });
});
