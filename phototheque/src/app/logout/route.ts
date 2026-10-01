import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/token";

/** Efface une session invalide (ex. mot de passe changé) puis renvoie vers la connexion. */
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set({ name: SESSION_COOKIE_NAME, value: "", path: "/", maxAge: 0 });
  return response;
}
