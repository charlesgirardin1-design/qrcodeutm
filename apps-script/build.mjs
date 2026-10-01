// Découpe Index.html en 6 fichiers Interface1.gs … Interface6.gs : node apps-script/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL("./", import.meta.url);
const PARTS = 6;
const b64 = readFileSync(new URL("Index.html", dir)).toString("base64");
const size = Math.ceil(b64.length / PARTS);
for (let i = 0; i < PARTS; i++) {
  const chunk = b64.slice(i * size, (i + 1) * size);
  const lines = chunk.match(/.{1,1000}/g).map((l) => `    '${l}' +`).join("\n");
  const code = `/** Interface — partie ${i + 1} / ${PARTS} (générée depuis Index.html, ne pas modifier). */
function interfacePart${i + 1}() {
  return (
${lines}
    ''
  );
}
// FIN DE LA PARTIE ${i + 1}
`;
  writeFileSync(new URL(`Interface${i + 1}.gs`, dir), code);
  console.log(`Interface${i + 1}.gs : ${code.split("\n").length} lignes, ${code.length} caractères`);
}
