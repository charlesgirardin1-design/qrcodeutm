// Intègre Index.html dans Code.gs (constante INDEX_HTML_B64) : node apps-script/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL("./", import.meta.url);
const html = readFileSync(new URL("Index.html", dir));
const b64 = html.toString("base64");
const lines = b64.match(/.{1,1000}/g).map((l) => `  '${l}',`).join("\n");
const marker = "// ==== INTERFACE INTÉGRÉE (générée depuis Index.html — ne pas modifier) ====";
let code = readFileSync(new URL("Code.gs", dir), "utf8");
const i = code.indexOf(marker);
if (i >= 0) code = code.slice(0, i).trimEnd() + "\n";
code += `\n${marker}\nconst INDEX_HTML_B64 = [\n${lines}\n];\n`;
writeFileSync(new URL("Code.gs", dir), code);
console.log(`Code.gs : ${code.split("\n").length} lignes`);
