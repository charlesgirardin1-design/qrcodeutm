import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { AnalyticsSummary } from "@/types";

interface GeoTableProps {
  countries: AnalyticsSummary["countries"];
  cities: AnalyticsSummary["cities"];
}

function Bar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
  );
}

export function GeoTable({ countries, cities }: GeoTableProps) {
  const maxCountry = Math.max(1, ...countries.map((c) => c.count));
  const maxCity = Math.max(1, ...cities.map((c) => c.count));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pays</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {countries.length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée.</p>}
          {countries.map((c) => (
            <div key={c.country} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{c.country}</span>
                <span className="tabular-nums text-muted-foreground">{formatNumber(c.count)}</span>
              </div>
              <Bar value={c.count} max={maxCountry} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Villes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cities.length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée.</p>}
          {cities.map((c) => (
            <div key={`${c.city}-${c.country}`} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>
                  {c.city}
                  {c.country ? `, ${c.country}` : ""}
                </span>
                <span className="tabular-nums text-muted-foreground">{formatNumber(c.count)}</span>
              </div>
              <Bar value={c.count} max={maxCity} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
