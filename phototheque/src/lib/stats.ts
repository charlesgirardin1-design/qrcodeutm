import "server-only";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { startOfMonth, startOfWeek } from "@/lib/dates";

export interface DashboardStats {
  total: number;
  toSort: number;
  sorted: number;
  photos: number;
  videos: number;
  thisWeek: number;
  thisMonth: number;
  totalBytes: number;
}

/** Statistiques calculées en temps réel depuis la base (aucun chiffre fictif). */
export async function getDashboardStats(): Promise<DashboardStats> {
  const ready = { uploadState: "READY" as const };
  const now = new Date();
  const [total, toSort, photos, thisWeek, thisMonth, size] = await prisma.$transaction([
    prisma.media.count({ where: ready }),
    prisma.media.count({ where: { ...ready, status: "TO_SORT" } }),
    prisma.media.count({ where: { ...ready, mediaType: "PHOTO" } }),
    prisma.media.count({ where: { ...ready, uploadedAt: { gte: startOfWeek(now, config.timezone) } } }),
    prisma.media.count({ where: { ...ready, uploadedAt: { gte: startOfMonth(now, config.timezone) } } }),
    prisma.media.aggregate({ where: ready, _sum: { fileSize: true } }),
  ]);
  return {
    total,
    toSort,
    sorted: total - toSort,
    photos,
    videos: total - photos,
    thisWeek,
    thisMonth,
    totalBytes: Number(size._sum.fileSize ?? 0),
  };
}

/** Répartition par catégorie (identifiant courant, nom historique le plus récent). */
export async function getCategoryBreakdown() {
  const rows = await prisma.media.groupBy({
    by: ["categoryId"],
    where: { uploadState: "READY" },
    _count: { _all: true },
  });
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const names = new Map(categories.map((c) => [c.id, c.name]));
  return rows
    .map((r) => ({ id: r.categoryId, name: (r.categoryId && names.get(r.categoryId)) || "Sans catégorie", count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}
