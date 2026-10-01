import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, readJson, ApiError } from "@/lib/api";
import { hasPermission } from "@/lib/auth/roles";
import { getCatalog } from "@/lib/catalog";
import { categoryCreateSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

/**
 * GET : catalogue catégories → activités.
 *  - tout utilisateur connecté : entrées actives (formulaire d'importation) ;
 *  - ?all=1 (ADMIN uniquement) : y compris inactives + compteurs.
 */
export const GET = withAuth(null, async (request, { session }) => {
  const all = new URL(request.url).searchParams.get("all") === "1";
  if (all && !hasPermission(session.role, "catalog:manage")) {
    throw new ApiError(403, "Accès refusé : action réservée à l'administrateur.");
  }
  const categories = await getCatalog({ onlyActive: !all, withCounts: all });
  return NextResponse.json({ categories });
});

export const POST = withAuth("catalog:manage", async (request, { session }) => {
  const data = categoryCreateSchema.parse(await readJson(request));
  const last = await prisma.category.aggregate({ _max: { displayOrder: true } });
  try {
    const category = await prisma.category.create({
      data: { name: data.name, description: data.description || null, displayOrder: (last._max.displayOrder ?? -1) + 1 },
    });
    await audit(session, "CATEGORY_CREATE", category.name);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "Une catégorie porte déjà ce nom.");
    }
    throw error;
  }
});
