import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(100),
  email: z.string().trim().email("Adresse e-mail invalide."),
  password: z.string().min(8, "8 caractères minimum."),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
