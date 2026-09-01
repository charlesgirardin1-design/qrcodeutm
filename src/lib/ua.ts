import { UAParser } from "ua-parser-js";
import type { DeviceType } from "@prisma/client";

export interface ParsedUserAgent {
  deviceType: DeviceType;
  os: string | null;
  browser: string | null;
}

export function parseUserAgent(userAgent: string | null): ParsedUserAgent {
  if (!userAgent) {
    return { deviceType: "OTHER", os: null, browser: null };
  }

  const parser = new UAParser(userAgent);
  const device = parser.getDevice();
  const os = parser.getOS();
  const browser = parser.getBrowser();

  let deviceType: DeviceType = "DESKTOP";
  if (device.type === "mobile") deviceType = "MOBILE";
  else if (device.type === "tablet") deviceType = "TABLET";
  else if (device.type && device.type !== "console" && device.type !== "smarttv") deviceType = "OTHER";

  return {
    deviceType,
    os: os.name ? `${os.name}${os.version ? ` ${os.version}` : ""}` : null,
    browser: browser.name ?? null,
  };
}
