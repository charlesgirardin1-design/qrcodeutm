import "server-only";
import type { Prisma } from "@prisma/client";
import { config } from "@/lib/config";
import { dayRange, monthRange, yearRange } from "@/lib/dates";

export const SORT_OPTIONS = ["capture_desc", "capture_asc", "upload_desc", "upload_asc", "name_asc", "name_desc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/**
 * Construit le filtre Prisma à partir des paramètres d'URL de la photothèque.
 * Seuls les médias READY (original stocké et vérifié) sont visibles.
 */
export function buildMediaWhere(params: URLSearchParams): Prisma.MediaWhereInput {
  const and: Prisma.MediaWhereInput[] = [{ uploadState: "READY" }];
  const tz = config.timezone;

  const status = params.get("status");
  if (status === "TO_SORT" || status === "SORTED") and.push({ status });

  const type = params.get("type");
  if (type === "PHOTO" || type === "VIDEO") and.push({ mediaType: type });

  const category = params.get("category");
  if (category) and.push({ categoryId: category });

  const activity = params.get("activity");
  if (activity) and.push({ activityId: activity });

  const photographer = params.get("photographer")?.trim();
  if (photographer) and.push({ photographer: { contains: photographer, mode: "insensitive" } });

  // Recherche plein texte simple : chaque mot doit apparaître dans au moins un champ.
  const q = params.get("q")?.trim();
  if (q) {
    for (const word of q.split(/\s+/).slice(0, 8)) {
      and.push({
        OR: [
          { originalFilename: { contains: word, mode: "insensitive" } },
          { photographer: { contains: word, mode: "insensitive" } },
          { categoryName: { contains: word, mode: "insensitive" } },
          { activityName: { contains: word, mode: "insensitive" } },
        ],
      });
    }
  }

  // Dates : date précise, période, mois ou année — sur la prise de vue (défaut) ou l'importation
  const field = params.get("dateField") === "upload" ? "uploadedAt" : "captureDate";
  const ranges: [Date, Date][] = [];
  const date = params.get("date");
  const month = params.get("month");
  const year = params.get("year");
  const from = params.get("from");
  const to = params.get("to");
  if (date) {
    const r = dayRange(date, tz);
    if (r) ranges.push(r);
  }
  if (month) {
    const r = monthRange(month, tz);
    if (r) ranges.push(r);
  }
  if (year) {
    const r = yearRange(year, tz);
    if (r) ranges.push(r);
  }
  for (const [gte, lt] of ranges) and.push({ [field]: { gte, lt } });
  if (from) {
    const r = dayRange(from, tz);
    if (r) and.push({ [field]: { gte: r[0] } });
  }
  if (to) {
    const r = dayRange(to, tz);
    if (r) and.push({ [field]: { lt: r[1] } });
  }

  return { AND: and };
}

export function buildMediaOrderBy(sort: string | null): Prisma.MediaOrderByWithRelationInput[] {
  switch (sort as SortOption) {
    case "capture_asc":
      return [{ captureDate: "asc" }, { id: "asc" }];
    case "upload_desc":
      return [{ uploadedAt: "desc" }, { id: "desc" }];
    case "upload_asc":
      return [{ uploadedAt: "asc" }, { id: "asc" }];
    case "name_asc":
      return [{ originalFilename: "asc" }, { id: "asc" }];
    case "name_desc":
      return [{ originalFilename: "desc" }, { id: "desc" }];
    case "capture_desc":
    default:
      return [{ captureDate: "desc" }, { id: "desc" }];
  }
}
