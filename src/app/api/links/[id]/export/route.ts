import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown) => {
    const str = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const link = await prisma.link.findUnique({ where: { id } });
  if (!link || link.userId !== user.id) {
    return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "json" ? "json" : "csv";

  const clicks = await prisma.click.findMany({
    where: { linkId: link.id },
    orderBy: { timestamp: "desc" },
    select: {
      timestamp: true,
      country: true,
      region: true,
      city: true,
      deviceType: true,
      os: true,
      browser: true,
      referrer: true,
      isUnique: true,
      ipHash: true,
    },
  });

  if (format === "json") {
    return NextResponse.json({ slug: link.slug, exportedAt: new Date().toISOString(), clicks });
  }

  const csv = toCsv(
    clicks.map((c) => ({
      timestamp: c.timestamp.toISOString(),
      country: c.country ?? "",
      region: c.region ?? "",
      city: c.city ?? "",
      deviceType: c.deviceType,
      os: c.os ?? "",
      browser: c.browser ?? "",
      referrer: c.referrer ?? "",
      isUnique: c.isUnique,
      ipHash: c.ipHash,
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clicks-${link.slug}.csv"`,
    },
  });
}
