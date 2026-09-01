import type { Link, Preset, Click, RedirectType, DeviceType } from "@prisma/client";
import type { QrConfig } from "@/lib/validations/qr";

export type { RedirectType, DeviceType };

export interface CustomParam {
  key: string;
  value: string;
}

export type LinkWithQrConfig = Omit<Link, "qrConfig" | "customParams"> & {
  qrConfig: QrConfig | null;
  customParams: CustomParam[] | null;
};

export interface LinkListItem extends LinkWithQrConfig {
  preset: Pick<Preset, "id" | "name"> | null;
  _count: { clicks: number };
}

export type { Preset, Click };

export type DateRangePreset = "24h" | "7d" | "30d" | "all" | "custom";

export interface AnalyticsSummary {
  totalClicks: number;
  uniqueClicks: number;
  clickTrend: { date: string; total: number; unique: number }[];
  countries: { country: string; count: number }[];
  cities: { city: string; country: string | null; count: number }[];
  devices: { deviceType: DeviceType; count: number }[];
  browsers: { browser: string; count: number }[];
  os: { os: string; count: number }[];
  referrers: { referrer: string; count: number }[];
  utmPerformance: {
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    totalClicks: number;
    uniqueClicks: number;
  }[];
}
