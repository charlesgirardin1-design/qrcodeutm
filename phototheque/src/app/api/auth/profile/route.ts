import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withAuth, readJson } from "@/lib/api";
import { profileSchema } from "@/lib/validations";
import { SESSION_COOKIE_NAME, signSessionToken, sessionCookieOptions, verifySessionToken } from "@/lib/auth/token";

/**
 * Met à jour le nom affiché dans la session (utilisé pour l'historique :
 * « trié par », journal d'activité). Utile tant que les comptes sont partagés.
 */
export const PATCH = withAuth(null, async (request) => {
  const { name } = profileSchema.parse(await readJson(request));
  const store = await cookies();
  const payload = await verifySessionToken(store.get(SESSION_COOKIE_NAME)?.value ?? "");
  if (!payload) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  // Conserve l'expiration d'origine de la session.
  const token = store.get(SESSION_COOKIE_NAME)!.value;
  const exp = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()).exp as number;
  const remaining = Math.max(60, exp - Math.floor(Date.now() / 1000));
  const next = await signSessionToken({ ...payload, name }, remaining);
  const response = NextResponse.json({ name });
  response.cookies.set({ ...sessionCookieOptions(remaining), value: next });
  return response;
});
