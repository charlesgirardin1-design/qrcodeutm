import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsSummary } from "@/types";

export function ReferrersTable({ referrers }: { referrers: AnalyticsSummary["referrers"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Referrers (sites d&apos;origine)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {referrers.length === 0 && <p className="text-sm text-muted-foreground">Aucun referrer détecté.</p>}
        {referrers.map((r) => (
          <div key={r.referrer} className="flex items-center justify-between text-sm">
            <span className="truncate">{r.referrer}</span>
            <span className="tabular-nums text-muted-foreground">{r.count}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
