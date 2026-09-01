"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsSummary } from "@/types";

const DEVICE_COLORS: Record<string, string> = {
  DESKTOP: "hsl(var(--primary))",
  MOBILE: "#22c55e",
  TABLET: "#f59e0b",
  OTHER: "#94a3b8",
};

const DEVICE_LABELS: Record<string, string> = {
  DESKTOP: "Ordinateur",
  MOBILE: "Mobile",
  TABLET: "Tablette",
  OTHER: "Autre",
};

interface DeviceBreakdownProps {
  devices: AnalyticsSummary["devices"];
  browsers: AnalyticsSummary["browsers"];
  os: AnalyticsSummary["os"];
}

export function DeviceBreakdown({ devices, browsers, os }: DeviceBreakdownProps) {
  const chartData = devices.map((d) => ({ name: DEVICE_LABELS[d.deviceType] ?? d.deviceType, key: d.deviceType, value: d.count }));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appareils</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={2}>
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={DEVICE_COLORS[entry.key] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Navigateurs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {browsers.length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée.</p>}
          {browsers.map((b) => (
            <div key={b.browser} className="flex justify-between text-sm">
              <span>{b.browser}</span>
              <span className="tabular-nums text-muted-foreground">{b.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Systèmes d&apos;exploitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {os.length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée.</p>}
          {os.map((o) => (
            <div key={o.os} className="flex justify-between text-sm">
              <span>{o.os}</span>
              <span className="tabular-nums text-muted-foreground">{o.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
