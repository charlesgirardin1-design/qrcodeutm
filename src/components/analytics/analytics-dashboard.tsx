"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangeSelector } from "@/components/analytics/date-range-selector";
import { KpiCards } from "@/components/analytics/kpi-cards";
import { ClicksChart } from "@/components/analytics/clicks-chart";
import { GeoTable } from "@/components/analytics/geo-table";
import { DeviceBreakdown } from "@/components/analytics/device-breakdown";
import { UtmPerformanceTable } from "@/components/analytics/utm-performance-table";
import { ReferrersTable } from "@/components/analytics/referrers-table";
import type { AnalyticsSummary, DateRangePreset } from "@/types";

interface AnalyticsDashboardProps {
  linkId?: string;
  title?: string;
}

export function AnalyticsDashboard({ linkId, title = "Analytics" }: AnalyticsDashboardProps) {
  const [range, setRange] = useState<DateRangePreset>("7d");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ range });
    if (linkId) params.set("linkId", linkId);

    fetch(`/api/analytics?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [range, linkId]);

  function handleExport(format: "csv" | "json") {
    if (!linkId) return;
    window.location.href = `/api/links/${linkId}/export?format=${format}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <DateRangeSelector value={range} onChange={setRange} />
          {linkId && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
                <Download /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("json")}>
                <Download /> JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {loading || !summary ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Chargement des statistiques...
        </div>
      ) : (
        <>
          <KpiCards summary={summary} />
          <ClicksChart data={summary.clickTrend} />
          <DeviceBreakdown devices={summary.devices} browsers={summary.browsers} os={summary.os} />
          <GeoTable countries={summary.countries} cities={summary.cities} />
          <div className="grid gap-4 lg:grid-cols-2">
            <UtmPerformanceTable data={summary.utmPerformance} />
            <ReferrersTable referrers={summary.referrers} />
          </div>
        </>
      )}
    </div>
  );
}
