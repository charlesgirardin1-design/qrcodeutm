import "server-only";

/** Configuration serveur centralisée (lue depuis les variables d'environnement). */
export const config = {
  timezone: process.env.APP_TIMEZONE || "Europe/Paris",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_SIZE_MB || 4096) * 1024 * 1024,
  storageDriver: (process.env.STORAGE_DRIVER || "local") as "local" | "s3",
  sessionHours: {
    USER: Number(process.env.SESSION_HOURS_USER || 168),
    ADMIN: Number(process.env.SESSION_HOURS_ADMIN || 12),
  },
};
