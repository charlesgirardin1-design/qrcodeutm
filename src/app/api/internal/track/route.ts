import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertInternalRequest, type TrackClickPayload } from "@/lib/internal-api";

// Runtime Node.js : persiste le clic en base via Prisma. Appelée en arrière-plan
// (via `after()`) par la route Edge de redirection, donc jamais sur le chemin
// critique de la latence perçue par l'utilisateur final.
export async function POST(request: Request) {
  if (!assertInternalRequest(request.headers)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as TrackClickPayload | null;
  if (!payload?.linkId || !payload.ipHash || !payload.visitorHash) {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }

  await prisma.click.create({
    data: {
      linkId: payload.linkId,
      ipHash: payload.ipHash,
      userAgent: payload.userAgent,
      referrer: payload.referrer,
      country: payload.country,
      region: payload.region,
      city: payload.city,
      latitude: payload.latitude,
      longitude: payload.longitude,
      deviceType: payload.deviceType,
      os: payload.os,
      browser: payload.browser,
      visitorHash: payload.visitorHash,
      isUnique: payload.isUnique,
    },
  });

  return NextResponse.json({ ok: true });
}
