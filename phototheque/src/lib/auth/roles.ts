/** Rôles et permissions — partagé client/serveur (aucun secret ici). */
export type Role = "USER" | "ADMIN";

export type Permission =
  | "media:upload"
  | "media:read"
  | "media:download"
  | "media:update"
  | "media:delete"
  | "catalog:manage"
  | "dashboard:view"
  | "settings:manage";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  USER: ["media:upload"],
  ADMIN: [
    "media:upload",
    "media:read",
    "media:download",
    "media:update",
    "media:delete",
    "catalog:manage",
    "dashboard:view",
    "settings:manage",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Page d'accueil selon le rôle après connexion. */
export function homePathFor(role: Role): string {
  return role === "ADMIN" ? "/dashboard" : "/import";
}

/** Préfixes de pages réservés à l'administrateur (vérifiés aussi côté serveur). */
export const ADMIN_PAGE_PREFIXES = ["/dashboard", "/phototheque", "/categories", "/parametres"];
export const AUTHENTICATED_PAGE_PREFIXES = ["/import", ...ADMIN_PAGE_PREFIXES];
