import { MousePointerClick, Users, TrendingUp, Globe2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { AnalyticsSummary } from "@/types";

interface KpiCardsProps {
  summary: AnalyticsSummary;
}

export function KpiCards({ summary }: KpiCardsProps) {
  const uniqueRate = summary.totalClicks > 0 ? Math.round((summary.uniqueClicks / summary.totalClicks) * 100) : 0;

  const cards = [
    { label: "Clics totaux", value: formatNumber(summary.totalClicks), icon: MousePointerClick },
    { label: "Clics uniques", value: formatNumber(summary.uniqueClicks), icon: Users },
    { label: "Taux d'unicité", value: `${uniqueRate}%`, icon: TrendingUp },
    { label: "Pays touchés", value: formatNumber(summary.countries.length), icon: Globe2 },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold tabular-nums">{value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
