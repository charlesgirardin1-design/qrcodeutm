import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@linkforge.app" },
    update: {},
    create: {
      email: "demo@linkforge.app",
      name: "Demo User",
      passwordHash,
    },
  });

  const preset = await prisma.preset.upsert({
    where: { id: "seed-preset-facebook-q3" },
    update: {},
    create: {
      id: "seed-preset-facebook-q3",
      name: "Campagne Facebook Ads Q3",
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "q3_promo",
      userId: user.id,
    },
  });

  const link = await prisma.link.upsert({
    where: { slug: "demo-link" },
    update: {},
    create: {
      slug: "demo-link",
      title: "Lien de démonstration",
      originalUrl: "https://example.com/landing",
      destinationUrl:
        "https://example.com/landing?utm_source=facebook&utm_medium=cpc&utm_campaign=q3_promo",
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "q3_promo",
      userId: user.id,
      presetId: preset.id,
    },
  });

  const now = Date.now();
  const countries: [string, string][] = [
    ["France", "Paris"],
    ["Belgique", "Bruxelles"],
    ["Canada", "Montréal"],
  ];

  for (let i = 0; i < 30; i += 1) {
    const [country, city] = countries[i % countries.length]!;
    await prisma.click.create({
      data: {
        linkId: link.id,
        timestamp: new Date(now - i * 3 * 60 * 60 * 1000),
        ipHash: `seed-ip-hash-${i}`,
        visitorHash: `seed-visitor-${i % 10}`,
        isUnique: i % 10 < 5,
        userAgent: "Mozilla/5.0 (demo seed)",
        referrer: i % 3 === 0 ? "https://facebook.com" : null,
        country,
        city,
        deviceType: i % 3 === 0 ? "MOBILE" : "DESKTOP",
        os: i % 2 === 0 ? "iOS 17" : "Windows 11",
        browser: i % 2 === 0 ? "Safari" : "Chrome",
      },
    });
  }

  console.log(`Seed terminé : utilisateur ${user.email}, lien /${link.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
