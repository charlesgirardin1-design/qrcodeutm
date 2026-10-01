import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession, type Session } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/roles";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * Protection CSRF : les requêtes qui modifient l'état doivent provenir de la
 * même origine (en complément du cookie SameSite=Lax).
 */
function assertSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return; // clients non navigateurs (tests, curl) : cookie requis de toute façon
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new ApiError(403, "Origine de la requête refusée.");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, "Origine de la requête refusée.");
  }
}

type Handler<C> = (request: Request, context: C & { session: Session }) => Promise<Response>;

/**
 * Enveloppe toutes les routes API : authentification, AUTORISATION CÔTÉ
 * SERVEUR selon la permission requise, CSRF et gestion homogène des erreurs.
 */
export function withAuth<C extends object = { params: Promise<Record<string, string>> }>(
  permission: Permission | null,
  handler: Handler<C>,
) {
  return async (request: Request, context: C): Promise<Response> => {
    try {
      assertSameOrigin(request);
      const session = await getSession();
      if (!session) return jsonError(401, "Session expirée. Veuillez vous reconnecter.", "UNAUTHENTICATED");
      if (permission && !hasPermission(session.role, permission)) {
        return jsonError(403, "Accès refusé : action réservée à l'administrateur.", "FORBIDDEN");
      }
      return await handler(request, { ...context, session });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) return jsonError(error.status, error.message, error.code);
  if (error instanceof ZodError) {
    return jsonError(400, error.issues[0]?.message ?? "Données invalides.", "VALIDATION");
  }
  console.error("[api]", error);
  return jsonError(500, "Une erreur inattendue est survenue. Veuillez réessayer.");
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Corps de requête JSON invalide.");
  }
}
