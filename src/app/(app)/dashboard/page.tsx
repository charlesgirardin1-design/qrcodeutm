import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, getAppUrl } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const recentLinks = await prisma.link.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { _count: { select: { clicks: true } } },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Vue d&apos;ensemble de tous vos liens.</p>
        </div>
        <Button asChild>
          <Link href="/links">
            <Plus /> Nouveau lien
          </Link>
        </Button>
      </div>

      <AnalyticsDashboard title="Performance globale" />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Liens récents</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {recentLinks.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Aucun lien pour le moment. Créez votre premier lien depuis l&apos;onglet « Liens ».
              </p>
            )}
            {recentLinks.map((link) => (
              <Link
                key={link.id}
                href={`/links/${link.id}`}
                className="flex items-center justify-between p-4 text-sm hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{link.title || `${getAppUrl()}/${link.slug}`}</p>
                  <p className="truncate text-xs text-muted-foreground">{link.destinationUrl}</p>
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <p className="font-semibold tabular-nums">{link._count.clicks} clics</p>
                  <p className="text-xs text-muted-foreground">{formatDate(link.createdAt, { dateStyle: "short" })}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
