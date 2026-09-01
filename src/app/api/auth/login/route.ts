import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signSessionToken, sessionCookieOptions } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Message d'erreur identique dans les deux cas pour ne pas révéler l'existence d'un compte.
  const invalidCredentials = () =>
    NextResponse.json({ error: "E-mail ou mot de passe incorrect." }, { status: 401 });

  if (!user) return invalidCredentials();

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return invalidCredentials();

  const token = await signSessionToken({ userId: user.id, email: user.email });

  const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  response.cookies.set(sessionCookieOptions.name, token, sessionCookieOptions);
  return response;
}
