import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, readJson, ApiError } from "@/lib/api";
import { activityCreateSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

/** Création d'une activité : elle apparaît immédiatement dans le formulaire d'importation. */
export const POST = withAuth("catalog:manage", async (request, { session }) => {
  const data = activityCreateSchema.parse(await readJson(request));
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category) throw new ApiError(404, "Catégorie introuvable.");
  const last = await prisma.activity.aggregate({ where: { categoryId: data.categoryId }, _max: { displayOrder: true } });
  try {
    const activity = await prisma.activity.create({
      data: { categoryId: data.categoryId, name: data.name, displayOrder: (last._max.displayOrder ?? -1) + 1 },
    });
    await audit(session, "ACTIVITY_CREATE", `${category.name} → ${activity.name}`);
    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "Cette activité existe déjà dans la catégorie.");
    }
    throw error;
  }
});
