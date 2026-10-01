import { z } from "zod";

const trimmed = (max: number, label: string) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .min(1, `${label} est obligatoire.`)
    .max(max, `${label} : ${max} caractères maximum.`);

export const loginSchema = z.object({
  password: z.string().min(1, "Veuillez saisir le mot de passe.").max(200),
});

export const uploadInitSchema = z.object({
  filename: trimmed(255, "Le nom du fichier"),
  mimeType: z.string().max(120).optional().default(""),
  size: z.number().int().positive("Le fichier est vide."),
  captureDate: z.iso.datetime({ offset: true, error: "La date de prise de vue est invalide." }),
  captureDateSource: z.enum(["EXIF", "VIDEO_METADATA", "FILE_DATE", "MANUAL"]).default("MANUAL"),
  photographer: trimmed(120, "Le nom du photographe"),
  categoryId: z.string().min(1, "Veuillez choisir une catégorie."),
  activityId: z.string().min(1, "Veuillez choisir une activité."),
  withDerivatives: z.boolean().default(false),
  derivativeFormat: z.enum(["webp", "jpg"]).default("webp"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSec: z.number().nonnegative().optional(),
});

export const mediaUpdateSchema = z
  .object({
    status: z.enum(["TO_SORT", "SORTED"]).optional(),
    photographer: trimmed(120, "Le nom du photographe").optional(),
    captureDate: z.iso.datetime({ offset: true }).optional(),
    categoryId: z.string().min(1).optional(),
    activityId: z.string().min(1).optional(),
  })
  .refine((v) => (v.categoryId === undefined) === (v.activityId === undefined), {
    message: "La catégorie et l'activité doivent être modifiées ensemble.",
  });

export const bulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set-status"),
    status: z.enum(["TO_SORT", "SORTED"]),
    ids: z.array(z.string().min(1)).min(1, "Aucun média sélectionné.").max(10000),
  }),
  z.object({
    action: z.literal("delete"),
    ids: z.array(z.string().min(1)).min(1, "Aucun média sélectionné.").max(10000),
  }),
]);

export const categoryCreateSchema = z.object({
  name: trimmed(80, "Le nom de la catégorie"),
  description: z.string().trim().max(300).optional().nullable(),
});

export const categoryUpdateSchema = z.object({
  name: trimmed(80, "Le nom de la catégorie").optional(),
  description: z.string().trim().max(300).optional().nullable(),
  active: z.boolean().optional(),
});

export const activityCreateSchema = z.object({
  categoryId: z.string().min(1),
  name: trimmed(80, "Le nom de l'activité"),
});

export const activityUpdateSchema = z.object({
  name: trimmed(80, "Le nom de l'activité").optional(),
  active: z.boolean().optional(),
});

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export const profileSchema = z.object({
  name: trimmed(60, "Le nom affiché"),
});
