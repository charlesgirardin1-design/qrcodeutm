import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, readJson } from "@/lib/api";
import { reorderSchema } from "@/lib/validations";

/** Réorganisation : `ids` dans le nouvel ordre d'affichage. */
export const POST = withAuth("catalog:manage", async (request) => {
  const { ids } = reorderSchema.parse(await readJson(request));
  await prisma.$transaction(ids.map((id, index) => prisma.category.update({ where: { id }, data: { displayOrder: index } })));
  return NextResponse.json({ ok: true });
});
