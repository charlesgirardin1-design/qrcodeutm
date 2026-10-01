import { downloadZip } from "client-zip";
import { prisma } from "@/lib/prisma";
import { withAuth, ApiError } from "@/lib/api";
import { contentDispositionHeader, getStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILES = 2000;

function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name.toLowerCase())) {
    used.add(name.toLowerCase());
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let i = 2; ; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!used.has(candidate.toLowerCase())) {
      used.add(candidate.toLowerCase());
      return candidate;
    }
  }
}

/**
 * Téléchargement multiple (ADMIN) : archive ZIP générée en flux contenant
 * uniquement les fichiers ORIGINAUX. Les entrées sont stockées sans
 * compression (méthode STORE de client-zip) : les octets de chaque fichier
 * sont recopiés à l'identique. Aucune miniature n'est incluse.
 *
 * Appelée par un formulaire POST (champ `ids`, séparés par des virgules) pour
 * que le navigateur gère nativement le téléchargement en continu.
 */
export const POST = withAuth("media:download", async (request) => {
  const form = await request.formData().catch(() => null);
  const raw = form?.get("ids");
  const ids = typeof raw === "string" ? [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))] : [];
  if (!ids.length) throw new ApiError(400, "Aucun média sélectionné.");
  if (ids.length > MAX_FILES) throw new ApiError(400, `Maximum ${MAX_FILES} médias par archive.`);

  const media = await prisma.media.findMany({
    where: { id: { in: ids }, uploadState: "READY" },
    orderBy: [{ captureDate: "asc" }, { id: "asc" }],
    select: { storageKey: true, originalFilename: true, fileSize: true, captureDate: true },
  });
  if (!media.length) throw new ApiError(404, "Les médias sélectionnés n'existent plus.");

  const storage = getStorage();
  const used = new Set<string>();
  const entries = media.map((m) => ({
    name: uniqueName(m.originalFilename, used),
    key: m.storageKey,
    size: Number(m.fileSize),
    lastModified: m.captureDate,
  }));

  // Ouverture paresseuse : un seul fichier lu à la fois.
  async function* files() {
    for (const entry of entries) {
      yield { name: entry.name, lastModified: entry.lastModified, size: entry.size, input: await storage.read(entry.key) };
    }
  }

  const zip = downloadZip(files(), {
    metadata: entries.map((e) => ({ name: e.name, size: e.size })),
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const headers = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": contentDispositionHeader("attachment", `phototheque-${stamp}-${media.length}-medias.zip`),
    "Cache-Control": "no-store",
  });
  const length = zip.headers.get("Content-Length");
  if (length) headers.set("Content-Length", length);
  return new Response(zip.body, { status: 200, headers });
});
