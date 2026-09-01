import { z } from "zod";

export const presetSchema = z.object({
  name: z.string().trim().min(1, "Le nom du preset est requis.").max(100),
  utmSource: z.string().trim().max(255).optional().or(z.literal("")),
  utmMedium: z.string().trim().max(255).optional().or(z.literal("")),
  utmCampaign: z.string().trim().max(255).optional().or(z.literal("")),
  utmTerm: z.string().trim().max(255).optional().or(z.literal("")),
  utmContent: z.string().trim().max(255).optional().or(z.literal("")),
});

export type PresetInput = z.infer<typeof presetSchema>;
