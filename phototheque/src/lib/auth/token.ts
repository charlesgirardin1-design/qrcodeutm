/**
 * Jetons de session (JWT HS256 via `jose`) — compatible Edge Runtime pour que
 * le middleware puisse vérifier la session. Aucun mot de passe n'y figure.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./roles";

export const SESSION_COOKIE_NAME = "phototheque_session";

export interface SessionPayload {
  /** id du User (compte partagé en V1, compte individuel plus tard) */
  sub: string;
  role: Role;
  /** nom affiché pour l'historique (modifiable dans Paramètres) */
  name: string;
  /** empreinte de la version du mot de passe : changer le mot de passe invalide les sessions */
  pv: string;
}

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET doit être défini (au moins 16 caractères).");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload, maxAgeSeconds: number): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name, pv: payload.pv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${Math.floor(maxAgeSeconds)}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    const role = payload.role;
    if (
      typeof payload.sub === "string" &&
      (role === "USER" || role === "ADMIN") &&
      typeof payload.name === "string" &&
      typeof payload.pv === "string"
    ) {
      return { sub: payload.sub, role, name: payload.name, pv: payload.pv };
    }
    return null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    // HTTPS obligatoire en production ; COOKIE_SECURE=false uniquement pour un test en HTTP sur réseau local.
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(maxAgeSeconds),
  };
}
