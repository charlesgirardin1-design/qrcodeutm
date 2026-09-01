import { z } from "zod";
import { isValidCustomSlug, RESERVED_SLUGS } from "@/lib/slug";

/** Validation d'URL stricte : http(s) uniquement, hostname valide obligatoire. */
export const urlSchema = z
  .string()
  .trim()
  .min(1, "L'URL de destination est requise.")
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL invalide. Utilisez une URL complète, ex: https://exemple.com" },
  );

const utmFieldRequired = z
  .string()
  .trim()
  .min(1, "Ce champ est obligatoire.")
  .max(255);

const utmFieldOptional = z.string().trim().max(255).optional().or(z.literal(""));

export const customParamSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "La clé est requise.")
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Uniquement lettres, chiffres, tirets et underscores."),
  value: z.string().trim().max(500),
});

export const utmFormSchema = z.object({
  destinationUrl: urlSchema,
  utmSource: utmFieldRequired,
  utmMedium: utmFieldRequired,
  utmCampaign: utmFieldRequired,
  utmTerm: utmFieldOptional,
  utmContent: utmFieldOptional,
  customParams: z.array(customParamSchema).max(20).default([]),
  lowercaseAndTrim: z.boolean().default(true),
});

export type UtmFormValues = z.infer<typeof utmFormSchema>;

export const createLinkSchema = utmFormSchema.extend({
  title: z.string().trim().max(150).optional().or(z.literal("")),
  customSlug: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || isValidCustomSlug(value), {
      message: "3 à 64 caractères : lettres, chiffres, tirets et underscores uniquement.",
    })
    .refine((value) => !value || !RESERVED_SLUGS.has(value.toLowerCase()), {
      message: "Ce slug est réservé, choisissez-en un autre.",
    }),
  redirectType: z.enum(["PERMANENT_301", "TEMPORARY_302"]).default("TEMPORARY_302"),
  expiresAt: z.string().datetime().optional().or(z.literal("")),
  presetId: z.string().cuid().optional().or(z.literal("")),
});

export type CreateLinkInput = z.infer<typeof createLinkSchema>;

/**
 * Construit l'URL finale (destination + utm_* + paramètres custom) à partir
 * des valeurs validées du formulaire. Utilisée à la fois côté client (preview
 * live) et côté serveur (persistance de `destinationUrl`).
 */
export function buildDestinationUrl(input: {
  destinationUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm?: string;
  utmContent?: string;
  customParams?: { key: string; value: string }[];
  lowercaseAndTrim?: boolean;
}): string {
  const normalize = (value: string) =>
    input.lowercaseAndTrim ? value.trim().toLowerCase() : value.trim();

  let url: URL;
  try {
    url = new URL(input.destinationUrl);
  } catch {
    return input.destinationUrl;
  }

  const params = url.searchParams;
  if (input.utmSource) params.set("utm_source", normalize(input.utmSource));
  if (input.utmMedium) params.set("utm_medium", normalize(input.utmMedium));
  if (input.utmCampaign) params.set("utm_campaign", normalize(input.utmCampaign));
  if (input.utmTerm) params.set("utm_term", normalize(input.utmTerm));
  if (input.utmContent) params.set("utm_content", normalize(input.utmContent));

  for (const param of input.customParams ?? []) {
    if (param.key) params.set(param.key, param.value);
  }

  return url.toString();
}
