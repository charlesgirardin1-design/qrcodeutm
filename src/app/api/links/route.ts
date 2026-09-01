import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, cacheKeys } from "@/lib/redis";
import { getCurrentUser } from "@/lib/session";
import { createLinkSchema, buildDestinationUrl } from "@/lib/validations/link";
import { generateSlug, isValidCustomSlug, RESERVED_SLUGS } from "@/lib/slug";
import { qrConfigSchema } from "@/lib/validations/qr";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q")?.trim();

  const links = await prisma.link.findMany({
    where: {
      userId: user.id,
      ...(search
        ? {
            OR: [
              { slug: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { utmCampaign: { contains: search, mode: "insensitive" } },
              { originalUrl: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { preset: { select: { id: true, name: true } }, _count: { select: { clicks: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ links });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }

  const data = parsed.data;

  let slug: string;
  if (data.customSlug) {
    if (!isValidCustomSlug(data.customSlug) || RESERVED_SLUGS.has(data.customSlug.toLowerCase())) {
      return NextResponse.json({ error: "Slug personnalisé invalide." }, { status: 400 });
    }
    const conflict = await prisma.link.findUnique({ where: { slug: data.customSlug } });
    if (conflict) {
      return NextResponse.json({ error: "Ce slug est déjà utilisé." }, { status: 409 });
    }
    slug = data.customSlug;
  } else {
    // Génère un slug unique — collisions extrêmement improbables (alphabet 55^7)
    // mais on boucle par sécurité jusqu'à trouver un slug libre.
    do {
      slug = generateSlug();
      // eslint-disable-next-line no-await-in-loop
    } while (await prisma.link.findUnique({ where: { slug } }));
  }

  const destinationUrl = buildDestinationUrl(data);

  const qrConfig = qrConfigSchema.parse({});

  const link = await prisma.link.create({
    data: {
      slug,
      title: data.title || null,
      originalUrl: data.destinationUrl,
      destinationUrl,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmTerm: data.utmTerm || null,
      utmContent: data.utmContent || null,
      customParams: data.customParams,
      redirectType: data.redirectType,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      presetId: data.presetId || null,
      qrConfig,
      userId: user.id,
    },
    include: { preset: { select: { id: true, name: true } }, _count: { select: { clicks: true } } },
  });

  // Pré-remplit le cache Redis pour que le premier hit de redirection soit déjà rapide.
  await redis
    .set(
      cacheKeys.linkBySlug(slug),
      JSON.stringify({
        id: link.id,
        destinationUrl: link.destinationUrl,
        redirectType: link.redirectType,
        isActive: link.isActive,
        expiresAt: link.expiresAt,
      }),
      { ex: 3600 },
    )
    .catch(() => undefined);

  return NextResponse.json({ link }, { status: 201 });
}
