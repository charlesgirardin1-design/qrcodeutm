import { z } from "zod";

const hexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Couleur hexadécimale invalide.");

export const qrGradientSchema = z.object({
  enabled: z.boolean().default(false),
  type: z.enum(["linear", "radial"]).default("linear"),
  rotation: z.number().min(0).max(360).default(0),
  colorStart: hexColor.default("#6366f1"),
  colorEnd: hexColor.default("#8b5cf6"),
});

export const qrConfigSchema = z.object({
  target: z.enum(["SHORT_LINK", "DESTINATION_URL"]).default("SHORT_LINK"),
  dotStyle: z
    .enum(["SQUARE", "DOTS", "ROUNDED", "CLASSY", "CLASSY_ROUNDED", "EXTRA_ROUNDED"])
    .default("ROUNDED"),
  cornerSquareStyle: z.enum(["square", "dot", "extra-rounded"]).default("extra-rounded"),
  cornerDotStyle: z.enum(["square", "dot"]).default("dot"),
  backgroundColor: hexColor.default("#ffffff"),
  dotsColor: hexColor.default("#111827"),
  cornersSquareColor: hexColor.default("#111827"),
  cornersDotColor: hexColor.default("#111827"),
  gradient: qrGradientSchema.default({
    enabled: false,
    type: "linear",
    rotation: 0,
    colorStart: "#6366f1",
    colorEnd: "#8b5cf6",
  }),
  logoDataUrl: z.string().nullable().default(null),
  logoMargin: z.number().min(0).max(40).default(8),
  logoSize: z.number().min(0.1).max(0.6).default(0.35),
  errorCorrectionLevel: z.enum(["L", "M", "Q", "H"]).default("Q"),
  size: z.number().min(128).max(2048).default(400),
  margin: z.number().min(0).max(64).default(16),
});

export type QrConfig = z.infer<typeof qrConfigSchema>;
export type QrGradient = z.infer<typeof qrGradientSchema>;

export const defaultQrConfig: QrConfig = qrConfigSchema.parse({});
