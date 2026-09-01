import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, QrCode } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { getAppUrl } from "@/lib/utils";

export default async function LinkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const link = await prisma.link.findUnique({ where: { id } });

  if (!link || !user || link.userId !== user.id) notFound();

  const shortUrl = `${getAppUrl()}/${link.slug}`;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link href="/links">
            <ArrowLeft /> Retour aux liens
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">/{link.slug}</h1>
            <p className="max-w-xl truncate text-sm text-muted-foreground">{link.destinationUrl}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {link.utmSource && <Badge variant="secondary">source: {link.utmSource}</Badge>}
              {link.utmMedium && <Badge variant="secondary">medium: {link.utmMedium}</Badge>}
              {link.utmCampaign && <Badge variant="secondary">campagne: {link.utmCampaign}</Badge>}
              <Badge variant={link.isActive ? "success" : "destructive"}>
                {link.isActive ? "Actif" : "Désactivé"}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={undefined} asChild>
              <a href={shortUrl} target="_blank" rel="noreferrer">
                {shortUrl}
              </a>
            </Button>
            <Button asChild>
              <Link href={`/qr-studio?linkId=${link.id}`}>
                <QrCode /> QR Code
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <AnalyticsDashboard linkId={link.id} title="Statistiques de ce lien" />
    </div>
  );
}
