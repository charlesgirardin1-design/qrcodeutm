import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { buildMediaOrderBy, buildMediaWhere } from "@/lib/media/filters";

/** Identifiants de TOUS les médias correspondant aux filtres (« Tout sélectionner »). */
export const GET = withAuth("media:read", async (request) => {
  const params = new URL(request.url).searchParams;
  const rows = await prisma.media.findMany({
    where: buildMediaWhere(params),
    orderBy: buildMediaOrderBy(params.get("sort")),
    select: { id: true },
    take: 10000,
  });
  return NextResponse.json({ ids: rows.map((r) => r.id) });
});
