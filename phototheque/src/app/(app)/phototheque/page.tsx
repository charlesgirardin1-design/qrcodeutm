import { Suspense } from "react";
import { requirePagePermission } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { Library } from "@/components/library/library";

export const metadata = { title: "Photothèque — Croix-Rouge" };

export default async function PhotothequePage() {
  await requirePagePermission("media:read");
  // Toutes les catégories (y compris désactivées) pour filtrer l'historique.
  const categories = await getCatalog({ onlyActive: false });
  return (
    <Suspense>
      <Library categories={categories} />
    </Suspense>
  );
}
