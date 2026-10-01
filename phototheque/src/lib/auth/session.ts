import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./token";
import { authProvider } from "./providers";
import { hasPermission, homePathFor, type Permission, type Role } from "./roles";

export interface Session {
  userId: string;
  role: Role;
  name: string;
}

/**
 * Session courante, vérifiée côté serveur (signature + expiration + version
 * des identifiants). Mémoïsée pour la durée de la requête.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const valid = await authProvider.isSessionValid(payload.sub, payload.pv);
  if (!valid) return null;
  return { userId: payload.sub, role: payload.role, name: payload.name };
});

/** Pour les Server Components / pages : redirige si non autorisé. */
export async function requirePagePermission(permission?: Permission): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/logout");
  if (permission && !hasPermission(session.role, permission)) redirect(homePathFor(session.role));
  return session;
}
