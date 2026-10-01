/**
 * Abstraction de stockage objet. Les ORIGINAUX sont écrits tels quels
 * (flux d'octets bruts, aucune transformation) ; les dérivés d'affichage
 * (miniature / aperçu) sont des objets distincts avec leurs propres clés.
 */
export interface UploadTarget {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface StoredObjectInfo {
  size: number;
  checksumSha256?: string;
}

export interface ReadOptions {
  /** octets demandés (inclusifs), pour la lecture vidéo par plages */
  range?: { start: number; end: number };
}

export interface StorageDriver {
  readonly name: "local" | "s3";
  /** URL vers laquelle le navigateur envoie directement le fichier (PUT brut). */
  createUploadTarget(key: string, contentType: string, mediaId: string, variant: UploadVariant): Promise<UploadTarget>;
  /** Écriture serveur (dérivés générés côté serveur, driver local). */
  put(key: string, body: Buffer | ReadableStream<Uint8Array>, contentType: string): Promise<StoredObjectInfo>;
  /** Métadonnées d'un objet, ou null s'il n'existe pas. */
  stat(key: string): Promise<StoredObjectInfo | null>;
  /** Flux de lecture (Web Stream) d'un objet. */
  read(key: string, options?: ReadOptions): Promise<ReadableStream<Uint8Array>>;
  /** Lecture complète en mémoire (réservé aux petits fichiers / génération de miniatures). */
  readBuffer(key: string): Promise<Buffer>;
  /**
   * URL signée temporaire (driver S3) pour servir l'objet directement depuis
   * le stockage, ou null si le serveur doit diffuser lui-même (driver local).
   */
  signedReadUrl(
    key: string,
    options: { filename?: string; disposition: "inline" | "attachment"; contentType?: string },
  ): Promise<string | null>;
  /** Suppression idempotente : un objet déjà absent n'est pas une erreur. */
  delete(key: string): Promise<void>;
  /** Liste des clés sous un préfixe (maintenance). */
  list?(prefix: string): AsyncIterable<string>;
}

export type UploadVariant = "original" | "thumbnail" | "preview";

export class StorageNotFoundError extends Error {
  constructor(key: string) {
    super(`Objet introuvable dans le stockage : ${key}`);
  }
}
