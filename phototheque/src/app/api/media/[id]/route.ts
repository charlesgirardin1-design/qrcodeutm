import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, readJson, ApiError } from "@/lib/api";
import { mediaUpdateSchema } from "@/lib/validations";
import { serializeMedia } from "@/lib/media/serialize";
import { deleteManyMedia, resolveCategoryActivity, setMediaStatus } from "@/lib/media/service";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

async function findReady(id: string) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media || media.uploadState !== "READY") throw new ApiError(404, "Ce média n'existe plus.");
  return media;
}

export const GET = withAuth<Ctx>("media:read", async (_request, { params }) => {
  const { id } = await params;
  return NextResponse.json({ media: serializeMedia(await findReady(id)) });
});

/** Changement de statut et/ou correction des métadonnées (ADMIN). */
export const PATCH = withAuth<Ctx>("media:update", async (request, { params, session }) => {
  const { id } = await params;
  const input = mediaUpdateSchema.parse(await readJson(request));
  const media = await findReady(id);

  if (input.status && input.status !== media.status) {
    await setMediaStatus([id], input.status, session);
  }

  const data: Record<string, unknown> = {};
  if (input.photographer !== undefined) data.photographer = input.photographer;
  if (input.captureDate !== undefined) {
    data.captureDate = new Date(input.captureDate);
    data.captureDateSource = "MANUAL";
  }
  if (input.categoryId && input.activityId && (input.categoryId !== media.categoryId || input.activityId !== media.activityId)) {
    // Correction explicite par l'administrateur : on enregistre les noms actuels.
    const names = await resolveCategoryActivity(input.categoryId, input.activityId, false);
    Object.assign(data, { categoryId: input.categoryId, activityId: input.activityId, ...names });
  }
  if (Object.keys(data).length) {
    await prisma.media.update({ where: { id }, data });
    await audit(session, "UPDATE", media.originalFilename);
  }

  return NextResponse.json({ media: serializeMedia(await findReady(id)) });
});

/** Suppression DÉFINITIVE (fichier original + dérivés + base). ADMIN uniquement. */
export const DELETE = withAuth<Ctx>("media:delete", async (_request, { params, session }) => {
  const { id } = await params;
  const result = await deleteManyMedia([id], session);
  const failure = result.failed[0];
  if (failure) {
    const status = failure.error === "Ce média n'existe plus." ? 404 : 500;
    return NextResponse.json({ error: failure.error }, { status });
  }
  return NextResponse.json({ ok: true, message: "Le média a été supprimé définitivement." });
});
