import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getAnalyticsSummary } from "@/lib/analytics";
import type { DateRangePreset } from "@/types";

const VALID_RANGES: DateRangePreset[] = ["24h", "7d", "30d", "all", "custom"];

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") ?? "7d") as DateRangePreset;
  const linkId = searchParams.get("linkId") ?? undefined;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: "Plage de dates invalide." }, { status: 400 });
  }

  if (linkId) {
    const link = await prisma.link.findUnique({ where: { id: linkId }, select: { userId: true } });
    if (!link || link.userId !== user.id) {
      return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });
    }
  }

  const summary = await getAnalyticsSummary({
    userId: user.id,
    linkId,
    range,
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
  });

  return NextResponse.json(summary);
}
