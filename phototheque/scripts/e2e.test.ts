/**
 * Tests de bout en bout de l'API (serveur lancé + base PostgreSQL réelle).
 *
 *   node scripts/make-fixtures.mjs
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 *
 * Variables : BASE_URL, USER_PASSWORD, ADMIN_PASSWORD, LOCAL_STORAGE_DIR
 * (pour vérifier la suppression physique avec le driver local).
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const USER_PASSWORD = process.env.USER_PASSWORD ?? "9205";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Com9205*";
const STORAGE_DIR = path.resolve(process.env.LOCAL_STORAGE_DIR ?? "./storage");
const FIXTURES = path.resolve("scripts/fixtures");
const prisma = new PrismaClient();
const runId = Math.random().toString(36).slice(2, 8);

const S3 = process.env.STORAGE_DRIVER === "s3";
const s3 = S3
  ? new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
    })
  : null;

/** Présence physique d'un objet dans le stockage configuré (disque local ou bucket S3). */
async function objectExists(key: string): Promise<boolean> {
  if (!s3) return existsSync(path.join(STORAGE_DIR, key));
  try {
    await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function removeObject(key: string) {
  if (!s3) return (await import("node:fs")).unlinkSync(path.join(STORAGE_DIR, key));
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
}

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

class Client {
  cookie = "";
  constructor(private ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`) {}
  async req(url: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    headers.set("x-forwarded-for", this.ip);
    const target = /^https?:/.test(url) ? url : BASE + url;
    if (/^https?:/.test(url)) {
      // URL pré-signée du stockage S3 : pas de cookie
      headers.delete("cookie");
      headers.delete("x-forwarded-for");
    }
    const res = await fetch(target, { ...init, headers, redirect: "manual" });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0]!;
    const location = res.headers.get("location");
    if (res.status === 302 && location && /^https?:/.test(location)) {
      // Redirection vers une URL signée (S3) : on la suit sans cookie.
      return fetch(location, { headers: init.headers });
    }
    return res;
  }
  json(url: string, method: string, body?: unknown) {
    return this.req(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  }
  async login(password: string) {
    return this.json("/api/auth/login", "POST", { password });
  }
}

const user = new Client();
const admin = new Client();
const anon = new Client();
let catalog: { id: string; name: string; activities: { id: string; name: string }[] }[] = [];
const uploaded: Record<string, string> = {};

function pick(category: string, activity: string) {
  const c = catalog.find((x) => x.name === category)!;
  const a = c.activities.find((x) => x.name === activity)!;
  return { categoryId: c.id, activityId: a.id };
}

async function upload(client: Client, file: string, meta: Record<string, unknown>) {
  const bytes = readFileSync(path.join(FIXTURES, file));
  const init = await client.json("/api/uploads", "POST", {
    filename: file,
    mimeType: "",
    size: bytes.length,
    captureDate: "2024-05-01T12:30:00.000Z",
    captureDateSource: "EXIF",
    photographer: `Photographe ${runId}`,
    ...meta,
  });
  const body = await init.json();
  if (!init.ok) return { status: init.status, body };
  const put = await client.req(body.targets.original.url, { method: "PUT", body: bytes, headers: body.targets.original.headers });
  assert.equal(put.status, 200, `PUT original ${file}`);
  const done = await client.req(`/api/uploads/${body.mediaId}/complete`, { method: "POST" });
  assert.equal(done.status, 200, `complete ${file}`);
  return { status: 201, body, bytes };
}

before(async () => {
  if (!existsSync(path.join(FIXTURES, "IMG_1234.JPG"))) execFileSync("node", ["scripts/make-fixtures.mjs"]);
});

test("connexion : mauvais mot de passe refusé", async () => {
  const res = await anon.login("0000");
  assert.equal(res.status, 401);
  assert.equal(anon.cookie, "");
});

test("connexion USER et ADMIN : rôle déterminé côté serveur", async () => {
  const u = await user.login(USER_PASSWORD);
  assert.equal(u.status, 200);
  assert.deepEqual(await u.json(), { role: "USER", redirectTo: "/import" });
  const a = await admin.login(ADMIN_PASSWORD);
  assert.equal(a.status, 200);
  assert.deepEqual(await a.json(), { role: "ADMIN", redirectTo: "/dashboard" });
});

test("les mots de passe ne figurent pas dans la page de connexion ni dans le JS client", async () => {
  const html = await (await anon.req("/login")).text();
  assert.ok(!html.includes(ADMIN_PASSWORD) && !html.includes(`"${USER_PASSWORD}"`));
  const scripts = [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]!);
  for (const src of scripts) {
    const js = await (await anon.req(src)).text();
    assert.ok(!js.includes(ADMIN_PASSWORD), `mot de passe admin trouvé dans ${src}`);
  }
});

test("non connecté : API et pages refusées", async () => {
  assert.equal((await anon.req("/api/media")).status, 401);
  assert.equal((await anon.req("/api/categories")).status, 401);
  const page = await anon.req("/dashboard");
  assert.equal(page.status, 307);
  assert.match(page.headers.get("location") ?? "", /\/login$/);
});

test("catalogue : catégories et activités initiales, « Formation » dans « Autre »", async () => {
  const res = await user.req("/api/categories");
  assert.equal(res.status, 200);
  catalog = (await res.json()).categories;
  assert.deepEqual(catalog.map((c) => c.name).slice(0, 4), ["US", "AS", "Activité de transfert", "Autre"]);
  const autre = catalog.find((c) => c.name === "Autre")!;
  assert.deepEqual(autre.activities.map((a) => a.name), ["Formation", "Autre"]);
  assert.deepEqual(catalog.find((c) => c.name === "AS")!.activities.map((a) => a.name), ["Maraude", "EBP", "Saintaniste", "DALO", "ALSO", "Autre"]);
});

test("USER : toutes les routes ADMIN sont refusées côté serveur (403)", async () => {
  const forbidden: [string, string, unknown?][] = [
    ["/api/media", "GET"],
    ["/api/media/ids", "GET"],
    ["/api/media/xyz", "GET"],
    ["/api/media/xyz", "PATCH", { status: "SORTED" }],
    ["/api/media/xyz", "DELETE"],
    ["/api/media/xyz/download", "GET"],
    ["/api/media/xyz/file?variant=thumbnail", "GET"],
    ["/api/media/bulk", "POST", { action: "delete", ids: ["xyz"] }],
    ["/api/media/bulk", "POST", { action: "set-status", status: "SORTED", ids: ["xyz"] }],
    ["/api/categories?all=1", "GET"],
    ["/api/categories", "POST", { name: "Pirate" }],
    ["/api/categories/xyz", "PATCH", { name: "Pirate" }],
    ["/api/categories/xyz", "DELETE"],
    ["/api/categories/reorder", "POST", { ids: ["a"] }],
    ["/api/activities", "POST", { categoryId: "x", name: "Pirate" }],
    ["/api/activities/xyz", "PATCH", { active: false }],
    ["/api/activities/xyz", "DELETE"],
    ["/api/maintenance", "GET"],
    ["/api/maintenance", "POST"],
  ];
  for (const [url, method, body] of forbidden) {
    const res = await user.json(url, method, body);
    assert.equal(res.status, 403, `${method} ${url} devrait être refusé (reçu ${res.status})`);
  }
  const zip = await user.req("/api/media/download", { method: "POST", body: new URLSearchParams({ ids: "xyz" }) });
  assert.equal(zip.status, 403);
});

test("USER : les pages ADMIN redirigent vers l'importation", async () => {
  for (const page of ["/dashboard", "/phototheque", "/categories", "/parametres"]) {
    const res = await user.req(page);
    assert.equal(res.status, 307, page);
    assert.match(res.headers.get("location") ?? "", /\/import$/);
  }
  assert.equal((await user.req("/import")).status, 200);
});

test("importation USER : photos et vidéos, statut À TRIER, métadonnées enregistrées", async () => {
  const files: [string, string, string][] = [
    ["IMG_1234.JPG", "AS", "Maraude"],
    ["affiche.png", "Autre", "Formation"],
    ["photo.HEIC", "US", "DPS"],
    ["video.MOV", "Activité de transfert", "Muguet"],
  ];
  for (const [file, cat, act] of files) {
    const result = await upload(user, file, pick(cat, act));
    assert.equal(result.status, 201, `${file}: ${JSON.stringify(result.body)}`);
    uploaded[file] = result.body.mediaId;
  }
  const media = await prisma.media.findMany({ where: { id: { in: Object.values(uploaded) } } });
  assert.equal(media.length, 4);
  for (const m of media) {
    assert.equal(m.status, "TO_SORT");
    assert.equal(m.uploadState, "READY");
    assert.equal(m.photographer, `Photographe ${runId}`);
    assert.equal(m.captureDate.toISOString(), "2024-05-01T12:30:00.000Z");
    assert.equal(m.uploadedByName, "Bénévole");
  }
  const jpg = media.find((m) => m.id === uploaded["IMG_1234.JPG"])!;
  assert.equal(jpg.originalFilename, "IMG_1234.JPG");
  assert.equal(jpg.mediaType, "PHOTO");
  assert.equal(jpg.categoryName, "AS");
  assert.equal(jpg.activityName, "Maraude");
  assert.match(jpg.storageKey, /IMG_1234\.JPG$/, "l'extension d'origine (casse incluse) est conservée");
  assert.ok(jpg.thumbnailKey && jpg.thumbnailKey !== jpg.storageKey, "miniature distincte de l'original");
  assert.equal(media.find((m) => m.id === uploaded["video.MOV"])!.mediaType, "VIDEO");
  assert.match(media.find((m) => m.id === uploaded["photo.HEIC"])!.storageKey, /photo\.HEIC$/);
});

test("importation : fichier non compatible refusé", async () => {
  const res = await upload(user, "notes.txt", pick("AS", "EBP"));
  assert.equal(res.status, 415);
  assert.equal(res.body.error, "Ce fichier n'est pas compatible.");
});

test("importation : activité qui n'appartient pas à la catégorie refusée", async () => {
  const wrong = { categoryId: pick("US", "DPS").categoryId, activityId: pick("AS", "Maraude").activityId };
  const res = await upload(user, "affiche.png", wrong);
  assert.equal(res.status, 400);
});

test("importation : fichier tronqué rejeté (taille vérifiée)", async () => {
  const init = await user.json("/api/uploads", "POST", {
    filename: "tronque.jpg",
    size: 1000,
    captureDate: new Date().toISOString(),
    photographer: "Test",
    ...pick("AS", "EBP"),
  });
  const { mediaId, targets } = await init.json();
  const put = await user.req(targets.original.url, { method: "PUT", body: Buffer.alloc(10), headers: targets.original.headers });
  // Driver local : refus immédiat. S3 : le bucket accepte, c'est la finalisation qui contrôle la taille.
  if (!S3) assert.equal(put.status, 400);
  const done = await user.req(`/api/uploads/${mediaId}/complete`, { method: "POST" });
  assert.equal(done.status, 400);
  await user.req(`/api/uploads/${mediaId}`, { method: "DELETE" });
  assert.equal(await prisma.media.count({ where: { id: mediaId } }), 0);
});

test("ORIGINAUX intacts : le téléchargement renvoie exactement les octets importés", async () => {
  for (const file of ["IMG_1234.JPG", "affiche.png", "photo.HEIC", "video.MOV"]) {
    const res = await admin.req(`/api/media/${uploaded[file]}/download`);
    assert.equal(res.status, 200, file);
    const body = Buffer.from(await res.arrayBuffer());
    assert.equal(sha256(body), sha256(readFileSync(path.join(FIXTURES, file))), `${file} modifié !`);
    const disposition = res.headers.get("content-disposition") ?? "";
    assert.ok(disposition.startsWith("attachment") && disposition.includes(`filename="${file}"`), disposition);
  }
  if (!S3) {
    const stored = await prisma.media.findUnique({ where: { id: uploaded["IMG_1234.JPG"] } });
    assert.equal(stored!.checksumSha256, sha256(readFileSync(path.join(FIXTURES, "IMG_1234.JPG"))));
  }
});

test("miniature : servie séparément, plus légère que l'original", async () => {
  const res = await admin.req(`/api/media/${uploaded["IMG_1234.JPG"]}/file?variant=thumbnail`);
  assert.equal(res.status, 200);
  if (!S3) assert.equal(res.headers.get("content-type"), "image/webp");
  const thumb = Buffer.from(await res.arrayBuffer());
  assert.ok(thumb.length < readFileSync(path.join(FIXTURES, "IMG_1234.JPG")).length / 5);
});

test("vidéo : lecture par plages (Range → 206)", async () => {
  const res = await admin.req(`/api/media/${uploaded["video.MOV"]}/file?variant=original`, { headers: { range: "bytes=0-99" } });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("content-range"), `bytes 0-99/${readFileSync(path.join(FIXTURES, "video.MOV")).length}`);
  assert.equal((await res.arrayBuffer()).byteLength, 100);
});

test("recherche et filtres", async () => {
  const list = async (qs: string) => (await (await admin.req(`/api/media?${qs}`)).json()) as { items: { id: string }[]; total: number };
  const photographer = encodeURIComponent(`Photographe ${runId}`);
  assert.equal((await list(`photographer=${photographer}`)).total, 4);
  assert.equal((await list(`photographer=${photographer}&type=VIDEO`)).total, 1);
  assert.equal((await list(`photographer=${photographer}&type=PHOTO`)).total, 3);
  assert.equal((await list(`photographer=${photographer}&category=${pick("AS", "Maraude").categoryId}`)).total, 1);
  assert.equal((await list(`photographer=${photographer}&activity=${pick("Autre", "Formation").activityId}`)).total, 1);
  assert.equal((await list(`photographer=${photographer}&month=2024-05`)).total, 4);
  assert.equal((await list(`photographer=${photographer}&year=2023`)).total, 0);
  assert.equal((await list(`photographer=${photographer}&date=2024-05-01`)).total, 4);
  assert.equal((await list(`photographer=${photographer}&from=2024-04-01&to=2024-04-30`)).total, 0);
  assert.equal((await list(`q=IMG_1234 ${runId}`)).total, 1, "recherche nom de fichier + photographe");
  assert.equal((await list(`q=maraude ${runId}`)).total, 1, "recherche activité");
  assert.equal((await list(`q=${encodeURIComponent("transfert")} ${runId}`)).total, 1, "recherche catégorie");
  const page = await list(`photographer=${photographer}&limit=2&sort=name_asc`);
  assert.equal(page.items.length, 2);
});

test("tri : passage à TRIÉE (date + auteur), statistiques mises à jour", async () => {
  const before = await (await admin.req(`/api/media?status=TO_SORT&photographer=${encodeURIComponent(`Photographe ${runId}`)}`)).json();
  const res = await admin.json(`/api/media/${uploaded["IMG_1234.JPG"]}`, "PATCH", { status: "SORTED" });
  assert.equal(res.status, 200);
  const { media } = await res.json();
  assert.equal(media.status, "SORTED");
  assert.ok(media.sortedAt);
  assert.equal(media.sortedByName, "Administrateur");
  const after = await (await admin.req(`/api/media?status=TO_SORT&photographer=${encodeURIComponent(`Photographe ${runId}`)}`)).json();
  assert.equal(after.total, before.total - 1);

  const bulk = await admin.json("/api/media/bulk", "POST", { action: "set-status", status: "SORTED", ids: [uploaded["affiche.png"], uploaded["IMG_1234.JPG"]] });
  assert.equal((await bulk.json()).updated, 1, "seuls les médias qui changent de statut sont comptés");
  const back = await admin.json(`/api/media/${uploaded["affiche.png"]}`, "PATCH", { status: "TO_SORT" });
  assert.equal((await back.json()).media.sortedAt, null);
});

test("téléchargement multiple : ZIP contenant les originaux identiques (sans miniatures)", async () => {
  const ids = [uploaded["IMG_1234.JPG"], uploaded["video.MOV"], uploaded["photo.HEIC"]];
  const res = await admin.req("/api/media/download", { method: "POST", body: new URLSearchParams({ ids: ids.join(",") }) });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/zip");
  const dir = mkdtempSync(path.join(tmpdir(), "zip-"));
  const zipPath = path.join(dir, "a.zip");
  writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  const listing = execFileSync("unzip", ["-Z1", zipPath]).toString().trim().split("\n").sort();
  assert.deepEqual(listing, ["IMG_1234.JPG", "photo.HEIC", "video.MOV"]);
  const methods = execFileSync("unzip", ["-v", zipPath]).toString();
  assert.ok(!/Defl/.test(methods), "aucune compression appliquée");
  for (const name of listing) {
    const extracted = execFileSync("unzip", ["-p", zipPath, name], { maxBuffer: 50 * 1024 * 1024 });
    assert.equal(sha256(extracted), sha256(readFileSync(path.join(FIXTURES, name))), `${name} différent dans le ZIP`);
  }
});

test("catégories/activités dynamiques : ajout visible dans le formulaire, historique préservé", async () => {
  const autre = catalog.find((c) => c.name === "Autre")!;
  const created = await admin.json("/api/activities", "POST", { categoryId: autre.id, name: `Réunion ${runId}` });
  assert.equal(created.status, 201);
  const { activity } = await created.json();
  const forUser = (await (await user.req("/api/categories")).json()).categories as typeof catalog;
  assert.ok(forUser.find((c) => c.id === autre.id)!.activities.some((a) => a.name === `Réunion ${runId}`));

  // Renommer une activité utilisée ne réécrit pas l'historique des médias
  const formation = pick("Autre", "Formation").activityId;
  const renamed = await admin.json(`/api/activities/${formation}`, "PATCH", { name: `Formation PSC1 ${runId}` });
  assert.equal(renamed.status, 200);
  const media = await prisma.media.findUnique({ where: { id: uploaded["affiche.png"] } });
  assert.equal(media!.activityName, "Formation");
  await admin.json(`/api/activities/${formation}`, "PATCH", { name: "Formation" });

  // Suppression d'une activité utilisée : refusée ; désactivation : OK et masquée pour USER
  assert.equal((await admin.json(`/api/activities/${formation}`, "DELETE")).status, 409);
  assert.equal((await admin.json(`/api/activities/${activity.id}`, "PATCH", { active: false })).status, 200);
  const afterDisable = (await (await user.req("/api/categories")).json()).categories as typeof catalog;
  assert.ok(!afterDisable.find((c) => c.id === autre.id)!.activities.some((a) => a.id === activity.id));
  assert.equal((await admin.json(`/api/activities/${activity.id}`, "DELETE")).status, 200, "inutilisée : suppression possible");

  // Catégorie : création, réorganisation, suppression si vide, refus si utilisée
  const cat = await admin.json("/api/categories", "POST", { name: `Événement ${runId}` });
  assert.equal(cat.status, 201);
  const { category } = await cat.json();
  assert.equal((await admin.json(`/api/categories/${pick("AS", "Maraude").categoryId}`, "DELETE")).status, 409);
  assert.equal((await admin.json(`/api/categories/${category.id}`, "DELETE")).status, 200);
  const all = (await (await admin.req("/api/categories?all=1")).json()).categories as typeof catalog;
  const order = all.map((c) => c.id);
  assert.equal((await admin.json("/api/categories/reorder", "POST", { ids: [...order].reverse() })).status, 200);
  assert.equal((await admin.json("/api/categories/reorder", "POST", { ids: order })).status, 200);
});

test("suppression ADMIN : fichier original + miniature réellement supprimés du stockage et de la base", async () => {
  const id = uploaded["IMG_1234.JPG"]!;
  const media = await prisma.media.findUnique({ where: { id } });
  const originalKey = media!.storageKey;
  const thumbKey = media!.thumbnailKey!;
  assert.ok((await objectExists(originalKey)) && (await objectExists(thumbKey)));

  assert.equal((await user.json(`/api/media/${id}`, "DELETE")).status, 403, "USER ne peut pas supprimer");
  assert.ok(await objectExists(originalKey));

  const res = await admin.json(`/api/media/${id}`, "DELETE");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).message, "Le média a été supprimé définitivement.");
  assert.ok(!(await objectExists(originalKey)), "original toujours présent dans le stockage");
  assert.ok(!(await objectExists(thumbKey)), "miniature toujours présente dans le stockage");
  assert.equal(await prisma.media.count({ where: { id } }), 0);
  assert.equal((await admin.req(`/api/media/${id}/download`)).status, 404);
  assert.equal((await admin.json(`/api/media/${id}`, "DELETE")).status, 404, "déjà supprimé : erreur claire");
});

test("suppression : fichier déjà absent du stockage → suppression quand même cohérente", async () => {
  const id = uploaded["photo.HEIC"]!;
  const media = await prisma.media.findUnique({ where: { id } });
  await removeObject(media!.storageKey);
  const res = await admin.json(`/api/media/${id}`, "DELETE");
  assert.equal(res.status, 200);
  assert.equal(await prisma.media.count({ where: { id } }), 0);
});

test("suppression multiple", async () => {
  const ids = [uploaded["affiche.png"]!, uploaded["video.MOV"]!];
  const keys = (await prisma.media.findMany({ where: { id: { in: ids } } })).map((m) => m.storageKey);
  const res = await admin.json("/api/media/bulk", "POST", { action: "delete", ids: [...ids, "inexistant"] });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.deleted.sort(), [...ids].sort());
  assert.equal(body.failed.length, 1);
  for (const key of keys) assert.ok(!(await objectExists(key)));
  assert.equal(await prisma.media.count({ where: { id: { in: ids } } }), 0);
});

test("tableau de bord accessible à ADMIN uniquement", async () => {
  assert.equal((await admin.req("/dashboard")).status, 200);
  assert.equal((await user.req("/dashboard")).status, 307);
});

test("anti force brute : blocage après 8 échecs depuis la même IP", async () => {
  const attacker = new Client("203.0.113.77");
  for (let i = 0; i < 8; i++) assert.equal((await attacker.login(`faux${i}`)).status, 401);
  assert.equal((await attacker.login(ADMIN_PASSWORD)).status, 429);
  await prisma.loginAttempt.deleteMany({});
  await prisma.$disconnect();
});
