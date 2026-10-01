/**
 * Génère dist/Code.gs : UN SEUL fichier à coller dans Apps Script.
 *  - Code.gs (serveur) compacté
 *  - Index.html (interface) compacté, compressé et intégré dans la fonction indexHtml_()
 * Usage : npm i terser && node apps-script/build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { minify } from "terser";
import { gzipSync } from "node:zlib";

const dir = new URL("./", import.meta.url);
const read = (f) => readFileSync(new URL(f, dir), "utf8");

// --- Serveur : on garde les noms des fonctions globales (appelées par google.script.run)
const server = await minify(read("Code.gs"), {
  toplevel: false,
  compress: { passes: 2 },
  mangle: true,
  format: { ascii_only: false, max_line_len: 300 },
});

// --- Interface : CSS et JS compactés
let html = read("Index.html");
html = html.replace(/<style>([\s\S]*?)<\/style>/, (_, css) =>
  "<style>" + css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*\n\s*/g, "").replace(/\s*([{}:;,>])\s*/g, "$1").replace(/;}/g, "}") + "</style>");
const js = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const client = await minify(js, { toplevel: false, compress: { passes: 2 }, mangle: true });
html = html.replace(js, () => client.code).replace(/>\s*\n\s*</g, "><");

// Interface compressée (gzip + base64), décompressée par Apps Script (Utilities.ungzip)
const b64 = gzipSync(Buffer.from(html, "utf8"), { level: 9 }).toString("base64");
const htmlFn =
  "function indexHtml_(){var b=\"\"\n" +
  b64.match(/.{1,200}/g).map((p) => '+"' + p + '"').join("\n") +
  ";\nreturn Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(b),'application/x-gzip')).getDataAsString('UTF-8');}";

const header = `/**
 * PHOTOTHÈQUE — Croix-Rouge française, UL Boulogne-Billancourt
 * Fichier unique Google Apps Script (serveur + interface).
 * 1. Collez TOUT ce fichier dans Code.gs (la dernière ligne est « // FIN DU FICHIER »).
 * 2. Remplacez appsscript.json par le manifeste fourni.
 * 3. Déployer > Nouveau déploiement > Application Web (Exécuter en tant que : Moi ; Accès : Tout le monde).
 * L'installation (dossier Drive, base Google Sheets, mots de passe 9205 / Com9205*) se fait
 * automatiquement à la première ouverture. Mots de passe modifiables dans
 * Paramètres du projet > Propriétés du script.
 * Version lisible du code : apps-script/Code.gs et apps-script/Index.html du dépôt.
 */
`;
const out = header + server.code + "\n" + htmlFn + "\n// FIN DU FICHIER\n";
mkdirSync(new URL("dist/", dir), { recursive: true });
writeFileSync(new URL("dist/Code.gs", dir), out);
console.log(`dist/Code.gs : ${out.split("\n").length} lignes, ${Math.round(out.length / 1024)} Ko`);
