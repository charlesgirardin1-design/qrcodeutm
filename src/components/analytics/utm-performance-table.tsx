import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsSummary } from "@/types";

interface UtmPerformanceTableProps {
  data: AnalyticsSummary["utmPerformance"];
}

export function UtmPerformanceTable({ data }: UtmPerformanceTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Performance par campagne UTM</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Source</th>
              <th className="pb-2 font-medium">Medium</th>
              <th className="pb-2 font-medium">Campagne</th>
              <th className="pb-2 text-right font-medium">Clics totaux</th>
              <th className="pb-2 text-right font-medium">Clics uniques</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted-foreground">
                  Aucune donnée sur cette période.
                </td>
              </tr>
            )}
            {data.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2">
                  <Badge variant="secondary">{row.utmSource || "—"}</Badge>
                </td>
                <td className="py-2">{row.utmMedium || "—"}</td>
                <td className="py-2">{row.utmCampaign || "—"}</td>
                <td className="py-2 text-right tabular-nums">{row.totalClicks}</td>
                <td className="py-2 text-right tabular-nums">{row.uniqueClicks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
