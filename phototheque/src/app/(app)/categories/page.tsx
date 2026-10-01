import { requirePagePermission } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { CatalogManager } from "@/components/catalog/catalog-manager";

export const metadata = { title: "Catégories & activités — Photothèque" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requirePagePermission("catalog:manage");
  const categories = await getCatalog({ onlyActive: false, withCounts: true });
  return <CatalogManager initial={categories} />;
}
