import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, readJson, ApiError } from "@/lib/api";
import { activityUpdateSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Renommer / (dés)activer. Les médias existants conservent leur nom d'activité historique. */
export const PATCH = withAuth<Ctx>("catalog:manage", async (request, { params, session }) => {
  const { id } = await params;
  const data = activityUpdateSchema.parse(await readJson(request));
  try {
    const activity = await prisma.activity.update({ where: { id }, data, include: { category: true } });
    const what = data.active === false ? "ACTIVITY_DISABLE" : data.active === true ? "ACTIVITY_ENABLE" : "ACTIVITY_UPDATE";
    await audit(session, what, `${activity.category.name} → ${activity.name}`);
    return NextResponse.json({ activity });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new ApiError(409, "Cette activité existe déjà dans la catégorie.");
      if (error.code === "P2025") throw new ApiError(404, "Activité introuvable.");
    }
    throw error;
  }
});

/** Suppression uniquement si aucun média n'utilise l'activité (sinon : désactivation). */
export const DELETE = withAuth<Ctx>("catalog:manage", async (_request, { params, session }) => {
  const { id } = await params;
  const activity = await prisma.activity.findUnique({ where: { id }, include: { category: true } });
  if (!activity) throw new ApiError(404, "Activité introuvable.");
  const used = await prisma.media.count({ where: { activityId: id } });
  if (used > 0) {
    throw new ApiError(
      409,
      `Impossible de supprimer « ${activity.name} » : ${used} média(s) l'utilisent. Désactivez-la plutôt pour conserver l'historique.`,
    );
  }
  await prisma.activity.delete({ where: { id } });
  await audit(session, "ACTIVITY_DELETE", `${activity.category.name} → ${activity.name}`);
  return NextResponse.json({ ok: true });
});
