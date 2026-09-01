import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { qrConfigSchema } from "@/lib/validations/qr";
import { QrCodeStudio, type QrStudioLink } from "@/components/qr-studio/qr-code-studio";

interface QrStudioPageProps {
  searchParams: Promise<{ linkId?: string }>;
}

export default async function QrStudioPage({ searchParams }: QrStudioPageProps) {
  const { linkId } = await searchParams;
  const user = await getCurrentUser();
  let studioLink: QrStudioLink | null = null;

  if (linkId && user) {
    const link = await prisma.link.findUnique({ where: { id: linkId } });
    if (link && link.userId === user.id) {
      const parsedConfig = qrConfigSchema.safeParse(link.qrConfig ?? {});
      studioLink = {
        id: link.id,
        slug: link.slug,
        destinationUrl: link.destinationUrl,
        qrConfig: parsedConfig.success ? parsedConfig.data : null,
      };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">QR Code Studio</h1>
        <p className="text-sm text-muted-foreground">
          {studioLink
            ? "Personnalisez le QR code de ce lien : couleurs, formes, logo et correction d'erreur."
            : "Générez un QR code personnalisé pour n'importe quelle URL, ou associez-le à un lien traqué."}
        </p>
      </div>
      <QrCodeStudio link={studioLink} />
    </div>
  );
}
