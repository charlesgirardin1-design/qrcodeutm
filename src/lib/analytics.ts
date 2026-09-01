import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AnalyticsSummary, DateRangePreset } from "@/types";

export interface GetAnalyticsOptions {
  userId: string;
  linkId?: string;
  range: DateRangePreset;
  from?: Date;
  to?: Date;
}

function resolveDateRange(range: DateRangePreset, from?: Date, to?: Date): { start: Date | null; end: Date } {
  const end = to ?? new Date();
  if (range === "custom" && from) return { start: from, end };
  if (range === "all") return { start: null, end };

  const start = new Date(end);
  if (range === "24h") start.setHours(start.getHours() - 24);
  else if (range === "7d") start.setDate(start.getDate() - 7);
  else if (range === "30d") start.setDate(start.getDate() - 30);

  return { start, end };
}

/**
 * Agrège les métriques d'analytics pour un utilisateur (tous ses liens, ou un
 * lien spécifique via `linkId`). Utilise `groupBy` de Prisma pour les
 * répartitions catégorielles (peu coûteux grâce aux index composites du
 * schéma) et une requête SQL brute pour la série temporelle jour par jour
 * (bucket `date_trunc`, non exprimable via l'API Prisma standard).
 */
export async function getAnalyticsSummary({
  userId,
  linkId,
  range,
  from,
  to,
}: GetAnalyticsOptions): Promise<AnalyticsSummary> {
  const { start, end } = resolveDateRange(range, from, to);

  const linkIds = linkId
    ? [linkId]
    : (await prisma.link.findMany({ where: { userId }, select: { id: true } })).map((l) => l.id);

  if (linkIds.length === 0) {
    return {
      totalClicks: 0,
      uniqueClicks: 0,
      clickTrend: [],
      countries: [],
      cities: [],
      devices: [],
      browsers: [],
      os: [],
      referrers: [],
      utmPerformance: [],
    };
  }

  const whereClause = {
    linkId: { in: linkIds },
    ...(start ? { timestamp: { gte: start, lte: end } } : {}),
  };

  const [total, unique, countryGroups, cityGroups, deviceGroups, browserGroups, osGroups, referrerGroups, trend] =
    await Promise.all([
      prisma.click.count({ where: whereClause }),
      prisma.click.count({ where: { ...whereClause, isUnique: true } }),
      prisma.click.groupBy({
        by: ["country"],
        where: { ...whereClause, country: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { country: "desc" } },
        take: 10,
      }),
      prisma.click.groupBy({
        by: ["city", "country"],
        where: { ...whereClause, city: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { city: "desc" } },
        take: 10,
      }),
      prisma.click.groupBy({
        by: ["deviceType"],
        where: whereClause,
        _count: { _all: true },
        orderBy: { _count: { deviceType: "desc" } },
      }),
      prisma.click.groupBy({
        by: ["browser"],
        where: { ...whereClause, browser: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { browser: "desc" } },
        take: 8,
      }),
      prisma.click.groupBy({
        by: ["os"],
        where: { ...whereClause, os: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { os: "desc" } },
        take: 8,
      }),
      prisma.click.groupBy({
        by: ["referrer"],
        where: { ...whereClause, referrer: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { referrer: "desc" } },
        take: 10,
      }),
      prisma.$queryRaw<{ day: Date; total: bigint; unique: bigint }[]>`
        SELECT date_trunc('day', "timestamp") AS day,
               COUNT(*)::bigint AS total,
               COUNT(*) FILTER (WHERE "isUnique")::bigint AS unique
        FROM "Click"
        WHERE "linkId" = ANY(${linkIds})
          ${start ? Prisma.sql`AND "timestamp" >= ${start} AND "timestamp" <= ${end}` : Prisma.empty}
        GROUP BY day
        ORDER BY day ASC
      `,
    ]);

  const utmPerformanceRaw = await prisma.link.findMany({
    where: { id: { in: linkIds } },
    select: {
      id: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      clicks: {
        where: start ? { timestamp: { gte: start, lte: end } } : undefined,
        select: { isUnique: true },
      },
    },
  });

  const utmMap = new Map<
    string,
    { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; totalClicks: number; uniqueClicks: number }
  >();
  for (const link of utmPerformanceRaw) {
    const key = `${link.utmSource ?? ""}|${link.utmMedium ?? ""}|${link.utmCampaign ?? ""}`;
    const entry = utmMap.get(key) ?? {
      utmSource: link.utmSource,
      utmMedium: link.utmMedium,
      utmCampaign: link.utmCampaign,
      totalClicks: 0,
      uniqueClicks: 0,
    };
    entry.totalClicks += link.clicks.length;
    entry.uniqueClicks += link.clicks.filter((c) => c.isUnique).length;
    utmMap.set(key, entry);
  }

  return {
    totalClicks: total,
    uniqueClicks: unique,
    clickTrend: trend.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      total: Number(row.total),
      unique: Number(row.unique),
    })),
    countries: countryGroups.map((g) => ({ country: g.country!, count: g._count._all })),
    cities: cityGroups.map((g) => ({ city: g.city!, country: g.country, count: g._count._all })),
    devices: deviceGroups.map((g) => ({ deviceType: g.deviceType, count: g._count._all })),
    browsers: browserGroups.map((g) => ({ browser: g.browser!, count: g._count._all })),
    os: osGroups.map((g) => ({ os: g.os!, count: g._count._all })),
    referrers: referrerGroups.map((g) => ({ referrer: g.referrer!, count: g._count._all })),
    utmPerformance: Array.from(utmMap.values()).sort((a, b) => b.totalClicks - a.totalClicks),
  };
}
