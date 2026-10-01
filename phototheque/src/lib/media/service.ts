import "server-only";
import type { MediaStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/api";
import type { Session } from "@/lib/auth/session";

export type DeleteResult = { id: string; ok: true } | { id: string; ok: false; error: string };

/**
 * Suppression DÉFINITIVE d'un média (fichiers + base de données), conçue pour
 * éviter les suppressions partielles :
 *
 *  1. le média passe en état DELETING (masqué de la photothèque) ;
 *  2. suppression des dérivés (miniature/aperçu) puis de l'ORIGINAL dans le
 *     stockage — un objet déjà absent est considéré comme supprimé ;
 *     → si le stockage échoue, le média est restauré en READY : rien n'est
 *       perdu et l'administrateur peut réessayer ;
 *  3. suppression de la ligne en base ;
 *     → si la base échoue après la suppression des fichiers, la ligne reste
 *       en DELETING (invisible) et la suppression peut être relancée depuis
 *       Paramètres > Maintenance (opération idempotente).
 */
export async function deleteMediaPermanently(id: string): Promise<DeleteResult & { filename?: string }> {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return { id, ok: false, error: "Ce média n'existe plus." };

  const previousState = media.uploadState;
  await prisma.media.update({ where: { id }, data: { uploadState: "DELETING" } });

  const storage = getStorage();
  try {
    const derivatives = [media.thumbnailKey, media.previewKey].filter((k): k is string => Boolean(k));
    for (const key of derivatives) await storage.delete(key);
    // Les dérivés ont disparu : on les détache tout de suite, au cas où
    // l'original ne pourrait pas être supprimé.
    if (derivatives.length) {
      await prisma.media.update({ where: { id }, data: { thumbnailKey: null, previewKey: null } });
    }
    await storage.delete(media.storageKey);
  } catch (error) {
    console.error(`[delete] stockage en échec pour ${id}`, error);
    await prisma.media
      .update({ where: { id }, data: { uploadState: previousState } })
      .catch(() => undefined);
    return { id, ok: false, error: "Impossible de supprimer ce média. Veuillez réessayer." };
  }

  try {
    await prisma.media.delete({ where: { id } });
  } catch (error) {
    console.error(`[delete] base de données en échec pour ${id}`, error);
    return {
      id,
      ok: false,
      error: "Les fichiers ont été supprimés mais l'enregistrement n'a pas pu être effacé. Relancez la suppression.",
    };
  }
  return { id, ok: true, filename: media.originalFilename };
}

/** Suppression multiple avec parallélisme limité ; renvoie le détail par média. */
export async function deleteManyMedia(ids: string[], session: Session) {
  const unique = [...new Set(ids)];
  const results: (DeleteResult & { filename?: string })[] = [];
  const queue = [...unique];
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      const id = queue.shift()!;
      results.push(await deleteMediaPermanently(id));
    }
  });
  await Promise.all(workers);

  const deleted = results.filter((r) => r.ok);
  if (deleted.length) {
    const names = deleted.slice(0, 5).map((r) => r.filename).join(", ");
    await audit(session, "DELETE", deleted.length > 5 ? `${names}…` : names, deleted.length);
  }
  return {
    deleted: deleted.map((r) => r.id),
    failed: results.filter((r): r is { id: string; ok: false; error: string } => !r.ok),
  };
}

/** Change le statut de tri ; enregistre date + auteur du tri. */
export async function setMediaStatus(ids: string[], status: MediaStatus, session: Session) {
  const unique = [...new Set(ids)];
  const data =
    status === "SORTED"
      ? { status, sortedAt: new Date(), sortedById: session.userId, sortedByName: session.name }
      : { status, sortedAt: null, sortedById: null, sortedByName: null };

  const result = await prisma.media.updateMany({
    // On ne réécrit pas la date de tri des médias déjà dans le statut demandé.
    where: { id: { in: unique }, uploadState: "READY", status: { not: status } },
    data,
  });
  if (result.count) await audit(session, status === "SORTED" ? "SORT" : "UNSORT", undefined, result.count);
  return result.count;
}

/** Vérifie qu'une activité appartient bien à la catégorie et renvoie les noms (instantanés). */
export async function resolveCategoryActivity(categoryId: string, activityId: string, requireActive: boolean) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, include: { category: true } });
  if (!activity || activity.categoryId !== categoryId) {
    throw new ApiError(400, "L'activité choisie n'appartient pas à cette catégorie.");
  }
  if (requireActive && (!activity.active || !activity.category.active)) {
    throw new ApiError(400, "Cette catégorie ou activité n'est plus disponible.");
  }
  return { categoryName: activity.category.name, activityName: activity.name };
}
