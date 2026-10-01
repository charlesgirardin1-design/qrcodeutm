/**
 * Seed idempotent :
 *  - crée/maintient les deux comptes partagés (USER / ADMIN) ;
 *  - insère les catégories et activités initiales UNIQUEMENT si la table des
 *    catégories est vide (pour ne jamais recréer ce que l'administrateur a
 *    supprimé ou renommé). Peut donc être exécuté à chaque déploiement.
 */
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const INITIAL_CATEGORIES: { name: string; description?: string; activities: string[] }[] = [
  {
    name: "US",
    description: "Urgence et secourisme",
    activities: ["Poste de secours", "DPS", "Autre"],
  },
  {
    name: "AS",
    description: "Action sociale",
    activities: ["Maraude", "EBP", "Saintaniste", "DALO", "ALSO", "Autre"],
  },
  {
    name: "Activité de transfert",
    activities: ["JM", "Muguet", "Forme activité", "Banque alimentaire", "Autre"],
  },
  {
    name: "Autre",
    activities: ["Formation", "Autre"],
  },
];

async function main() {
  await prisma.user.upsert({
    where: { sharedKey: "user" },
    update: {},
    create: { sharedKey: "user", name: "Bénévole", role: Role.USER },
  });
  await prisma.user.upsert({
    where: { sharedKey: "admin" },
    update: {},
    create: { sharedKey: "admin", name: "Administrateur", role: Role.ADMIN },
  });

  const existing = await prisma.category.count();
  if (existing === 0) {
    for (const [index, category] of INITIAL_CATEGORIES.entries()) {
      await prisma.category.create({
        data: {
          name: category.name,
          description: category.description,
          displayOrder: index,
          activities: {
            create: category.activities.map((name, order) => ({ name, displayOrder: order })),
          },
        },
      });
    }
    console.log(`Seed : ${INITIAL_CATEGORIES.length} catégories initiales créées.`);
  } else {
    console.log("Seed : catégories déjà présentes, aucune modification.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
