import type { Options as QrStylingOptions } from "qr-code-styling";
import type { QrConfig } from "@/lib/validations/qr";

const DOT_STYLE_MAP = {
  SQUARE: "square",
  DOTS: "dots",
  ROUNDED: "rounded",
  CLASSY: "classy",
  CLASSY_ROUNDED: "classy-rounded",
  EXTRA_ROUNDED: "extra-rounded",
} as const;

/**
 * Traduit notre `QrConfig` (persisté en JSON dans `Link.qrConfig`) vers les
 * options attendues par la librairie `qr-code-styling`.
 */
export function toQrStylingOptions(config: QrConfig, data: string): QrStylingOptions {
  const dotsOptions: QrStylingOptions["dotsOptions"] = config.gradient.enabled
    ? {
        type: DOT_STYLE_MAP[config.dotStyle],
        gradient: {
          type: config.gradient.type,
          rotation: (config.gradient.rotation * Math.PI) / 180,
          colorStops: [
            { offset: 0, color: config.gradient.colorStart },
            { offset: 1, color: config.gradient.colorEnd },
          ],
        },
      }
    : { type: DOT_STYLE_MAP[config.dotStyle], color: config.dotsColor };

  return {
    width: config.size,
    height: config.size,
    margin: config.margin,
    data,
    qrOptions: {
      errorCorrectionLevel: config.errorCorrectionLevel,
    },
    imageOptions: {
      crossOrigin: "anonymous",
      margin: config.logoMargin,
      imageSize: config.logoSize,
      hideBackgroundDots: true,
    },
    dotsOptions,
    backgroundOptions: {
      color: config.backgroundColor,
    },
    cornersSquareOptions: {
      type: config.cornerSquareStyle,
      color: config.cornersSquareColor,
    },
    cornersDotOptions: {
      type: config.cornerDotStyle,
      color: config.cornersDotColor,
    },
    image: config.logoDataUrl ?? undefined,
  };
}
