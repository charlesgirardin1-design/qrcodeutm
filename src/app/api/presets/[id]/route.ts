import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { presetSchema } from "@/lib/validations/preset";

async function assertOwnership(userId: string, id: string) {
  const preset = await prisma.preset.findUnique({ where: { id } });
  if (!preset || preset.userId !== userId) return null;
  return preset;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const existing = await assertOwnership(user.id, id);
  if (!existing) return NextResponse.json({ error: "Preset introuvable." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = presetSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }

  const preset = await prisma.preset.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ preset });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const existing = await assertOwnership(user.id, id);
  if (!existing) return NextResponse.json({ error: "Preset introuvable." }, { status: 404 });

  await prisma.preset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
