import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, cacheKeys } from "@/lib/redis";
import { getCurrentUser } from "@/lib/session";
import { qrConfigSchema } from "@/lib/validations/qr";
import { z } from "zod";

async function assertOwnership(userId: string, id: string) {
  const link = await prisma.link.findUnique({ where: { id } });
  if (!link || link.userId !== userId) return null;
  return link;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const link = await assertOwnership(user.id, id);
  if (!link) return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });

  return NextResponse.json({ link });
}

const updateLinkSchema = z.object({
  isActive: z.boolean().optional(),
  title: z.string().trim().max(150).optional(),
  redirectType: z.enum(["PERMANENT_301", "TEMPORARY_302"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  qrConfig: qrConfigSchema.partial().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const existing = await assertOwnership(user.id, id);
  if (!existing) return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }

  const { qrConfig, expiresAt, ...rest } = parsed.data;

  const mergedQrConfig = qrConfig
    ? { ...(existing.qrConfig as object), ...qrConfig }
    : undefined;

  const link = await prisma.link.update({
    where: { id },
    data: {
      ...rest,
      ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
      ...(mergedQrConfig ? { qrConfig: mergedQrConfig } : {}),
    },
    include: { preset: { select: { id: true, name: true } }, _count: { select: { clicks: true } } },
  });

  // Invalide le cache Redis pour que la redirection reflète immédiatement le changement.
  await redis.del(cacheKeys.linkBySlug(link.slug)).catch(() => undefined);

  return NextResponse.json({ link });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const existing = await assertOwnership(user.id, id);
  if (!existing) return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });

  await prisma.link.delete({ where: { id } });
  await redis.del(cacheKeys.linkBySlug(existing.slug)).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
