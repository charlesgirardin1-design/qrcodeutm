import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "./roles";

/**
 * Identité authentifiée, indépendante de la méthode de connexion.
 * Pour passer à des comptes individuels, il suffira d'ajouter un
 * `AuthProvider` (ex. email + mot de passe sur la table User) sans toucher
 * au reste de l'application, qui ne manipule que des `Principal`.
 */
export interface Principal {
  userId: string;
  role: Role;
  name: string;
  /** empreinte de version des identifiants (invalidation des sessions) */
  credentialVersion: string;
}

export interface AuthProvider {
  authenticate(input: { password: string }): Promise<Principal | null>;
  /** vérifie qu'une session émise précédemment est toujours valide */
  isSessionValid(userId: string, credentialVersion: string): Promise<boolean>;
}

type SharedAccount = { key: "user" | "admin"; role: Role; defaultName: string };

const SHARED_ACCOUNTS: SharedAccount[] = [
  // L'ordre compte peu : les deux secrets sont toujours comparés (temps constant).
  { key: "admin", role: "ADMIN", defaultName: "Administrateur" },
  { key: "user", role: "USER", defaultName: "Bénévole" },
];

function secretFor(role: Role): { plain?: string; hash?: string } {
  if (role === "ADMIN") {
    return { plain: process.env.ADMIN_PASSWORD, hash: process.env.ADMIN_PASSWORD_HASH };
  }
  return { plain: process.env.USER_PASSWORD, hash: process.env.USER_PASSWORD_HASH };
}

function constantTimeEquals(a: string, b: string): boolean {
  // Comparaison d'empreintes de taille fixe : pas de fuite de longueur.
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

async function matches(role: Role, password: string): Promise<boolean> {
  const { plain, hash } = secretFor(role);
  if (hash) return bcrypt.compare(password, hash);
  if (plain) return constantTimeEquals(password, plain);
  return false;
}

/** Empreinte non réversible du secret courant (HMAC avec AUTH_SECRET). */
function credentialVersion(role: Role): string {
  const { plain, hash } = secretFor(role);
  return createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update(`${role}:${hash ?? plain ?? ""}`)
    .digest("base64url")
    .slice(0, 16);
}

async function getSharedUser(account: SharedAccount) {
  return prisma.user.upsert({
    where: { sharedKey: account.key },
    update: {},
    create: { sharedKey: account.key, name: account.defaultName, role: account.role },
  });
}

export const sharedPasswordProvider: AuthProvider = {
  async authenticate({ password }) {
    if (!password) return null;
    // On évalue les deux comptes pour garder un temps de réponse homogène.
    const results = await Promise.all(SHARED_ACCOUNTS.map((account) => matches(account.role, password)));
    const index = results.findIndex(Boolean);
    const account = index >= 0 ? SHARED_ACCOUNTS[index] : undefined;
    if (!account) return null;

    const user = await getSharedUser(account);
    if (!user.active) return null;
    return {
      userId: user.id,
      role: account.role,
      name: user.name,
      credentialVersion: credentialVersion(account.role),
    };
  },

  async isSessionValid(userId, version) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true } });
    if (!user || !user.active) return false;
    return credentialVersion(user.role) === version;
  },
};

/** Fournisseur actif. Remplacer ici pour passer aux comptes individuels. */
export const authProvider: AuthProvider = sharedPasswordProvider;
