import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, readJson, ApiError } from "@/lib/api";
import { categoryUpdateSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Modification (nom, description, activation). Renommer une catégorie ne
 * modifie PAS les médias existants : ils conservent leur nom historique.
 */
export const PATCH = withAuth<Ctx>("catalog:manage", async (request, { params, session }) => {
  const { id } = await params;
  const data = categoryUpdateSchema.parse(await readJson(request));
  try {
    const category = await prisma.category.update({
      where: { id },
      data: { name: data.name, description: data.description === undefined ? undefined : data.description || null, active: data.active },
    });
    const what = data.active === false ? "CATEGORY_DISABLE" : data.active === true ? "CATEGORY_ENABLE" : "CATEGORY_UPDATE";
    await audit(session, what, category.name);
    return NextResponse.json({ category });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new ApiError(409, "Une catégorie porte déjà ce nom.");
      if (error.code === "P2025") throw new ApiError(404, "Catégorie introuvable.");
    }
    throw error;
  }
});

/** Suppression autorisée uniquement si aucun média n'y est rattaché. */
export const DELETE = withAuth<Ctx>("catalog:manage", async (_request, { params, session }) => {
  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new ApiError(404, "Catégorie introuvable.");
  const used = await prisma.media.count({ where: { categoryId: id } });
  if (used > 0) {
    throw new ApiError(
      409,
      `Impossible de supprimer « ${category.name} » : ${used} média(s) y sont rattachés. Désactivez-la plutôt pour conserver l'historique.`,
    );
  }
  await prisma.category.delete({ where: { id } });
  await audit(session, "CATEGORY_DELETE", category.name);
  return NextResponse.json({ ok: true });
});
