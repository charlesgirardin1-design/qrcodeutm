import { NextResponse } from "next/server";
import { authProvider } from "@/lib/auth/providers";
import { signSessionToken, sessionCookieOptions } from "@/lib/auth/token";
import { homePathFor } from "@/lib/auth/roles";
import { clientIp, loginBlockedFor, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { config } from "@/lib/config";
import { loginSchema } from "@/lib/validations";
import { handleApiError, jsonError } from "@/lib/api";

/**
 * Connexion par mot de passe. Le rôle est déterminé CÔTÉ SERVEUR selon le
 * mot de passe saisi ; les mots de passe ne transitent jamais vers le client.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Requête invalide.");

    const ip = clientIp(request);
    const wait = await loginBlockedFor(ip);
    if (wait > 0) {
      return jsonError(429, `Trop de tentatives. Réessayez dans ${Math.ceil(wait / 60)} minute(s).`, "RATE_LIMITED");
    }

    const principal = await authProvider.authenticate({ password: parsed.data.password });
    await recordLoginAttempt(ip, Boolean(principal));
    if (!principal) return jsonError(401, "Mot de passe incorrect.", "INVALID_CREDENTIALS");

    const maxAge = config.sessionHours[principal.role] * 3600;
    const token = await signSessionToken(
      { sub: principal.userId, role: principal.role, name: principal.name, pv: principal.credentialVersion },
      maxAge,
    );
    const response = NextResponse.json({ role: principal.role, redirectTo: homePathFor(principal.role) });
    response.cookies.set({ ...sessionCookieOptions(maxAge), value: token });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
