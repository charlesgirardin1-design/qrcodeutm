// Génère des fichiers de test réalistes (JPEG avec date EXIF, PNG, etc.)
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";

const dir = new URL("./fixtures/", import.meta.url);
mkdirSync(dir, { recursive: true });

const width = 3000, height = 2000;
const noise = randomBytes(width * height * 3);
await sharp(noise, { raw: { width, height, channels: 3 } })
  .jpeg({ quality: 95 })
  .withExif({ IFD0: { Make: "TestCam", Model: "E2E" }, IFD2: { DateTimeOriginal: "2024:05:01 14:30:00" } })
  .toFile(new URL("IMG_1234.JPG", dir).pathname);

await sharp({ create: { width: 800, height: 600, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } })
  .png()
  .toFile(new URL("affiche.png", dir).pathname);

// Contenu arbitraire : le serveur doit les conserver tels quels même sans savoir les décoder.
writeFileSync(new URL("photo.HEIC", dir), Buffer.concat([Buffer.from("000000186674797068656963", "hex"), randomBytes(200_000)]));
writeFileSync(new URL("video.MOV", dir), Buffer.concat([Buffer.from("0000001466747970717420200000000071742020", "hex"), randomBytes(1_500_000)]));
writeFileSync(new URL("notes.txt", dir), "pas un média");
console.log("fixtures ok");
