import "server-only";
import { prisma } from "@/lib/prisma";

export interface ActivityDTO {
  id: string;
  name: string;
  active: boolean;
  displayOrder: number;
  mediaCount?: number;
}

export interface CategoryDTO {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
  mediaCount?: number;
  activities: ActivityDTO[];
}

/**
 * Catalogue catégories → activités lu depuis la base.
 * `onlyActive` : formulaire d'importation (seules les entrées actives).
 * `withCounts` : administration (nombre de médias rattachés).
 */
export async function getCatalog({ onlyActive, withCounts }: { onlyActive: boolean; withCounts?: boolean }): Promise<CategoryDTO[]> {
  const categories = await prisma.category.findMany({
    where: onlyActive ? { active: true } : undefined,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      activities: {
        where: onlyActive ? { active: true } : undefined,
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        include: withCounts ? { _count: { select: { media: true } } } : undefined,
      },
      ...(withCounts ? { _count: { select: { media: true } } } : {}),
    },
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    active: c.active,
    displayOrder: c.displayOrder,
    mediaCount: withCounts ? (c as unknown as { _count: { media: number } })._count.media : undefined,
    activities: c.activities.map((a) => ({
      id: a.id,
      name: a.name,
      active: a.active,
      displayOrder: a.displayOrder,
      mediaCount: withCounts ? (a as unknown as { _count: { media: number } })._count.media : undefined,
    })),
  }));
}
