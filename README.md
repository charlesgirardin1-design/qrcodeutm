# LinkForge

> Ce dépôt contient aussi la **Photothèque de la Croix-Rouge française (UL Boulogne-Billancourt)**, application autonome dans [`phototheque/`](phototheque/README.md).

SaaS d'optimisation, génération et suivi de liens : **UTM Builder** + **raccourcisseur de liens** + **analytics en temps réel** + **générateur de QR codes personnalisés**.

## Stack technique

- **Next.js 15** (App Router, Route Handlers, Edge Runtime pour la redirection, `after()` pour le tracking asynchrone)
- **TypeScript** strict
- **PostgreSQL** via **Prisma ORM**
- **Redis (Upstash REST)** pour le cache de résolution de slug et le comptage de clics
- **Tailwind CSS** + primitives style shadcn/ui + **Recharts**
- **qr-code-styling** (+ `jspdf`/`svg2pdf.js` pour l'export PDF vectoriel)
- Auth maison : JWT de session (`jose`, compatible Edge) + `bcryptjs`

## Architecture

```
src/
  app/
    (app)/                 # Espace authentifié (layout + sidebar)
      dashboard/page.tsx    # Analytics globales + liens récents
      links/page.tsx        # UTM Builder + liste des liens
      links/[id]/page.tsx   # Détail d'un lien + analytics dédiées
      qr-studio/page.tsx    # QR Code Studio
      presets/page.tsx      # Gestion des presets UTM
    login/ register/        # Pages d'authentification
    api/
      auth/{login,register,logout}/route.ts
      presets/route.ts, presets/[id]/route.ts
      links/route.ts, links/[id]/route.ts, links/[id]/export/route.ts
      analytics/route.ts     # Agrégations Prisma (KPI, séries temporelles, geo, UTM)
      internal/resolve/[slug]/route.ts  # Résolution Prisma (Node) pour cache miss Redis
      internal/track/route.ts           # Persistance des clics (Node/Prisma)
    [slug]/route.ts          # ⚡ Route de redirection — Edge Runtime
  components/
    utm-builder/  qr-studio/  analytics/  links/  presets/  layout/  ui/
  lib/
    prisma.ts  redis.ts  auth.ts  session.ts  password.ts
    slug.ts  geo.ts  ua.ts  analytics.ts  qr-styling-options.ts
    validations/{link,preset,auth,qr}.ts
prisma/
  schema.prisma
  seed.ts
```

### Pourquoi la redirection est séparée de Prisma

Prisma Client ne peut pas exécuter de requêtes SQL directement depuis l'Edge Runtime sans Prisma Accelerate ou des driver adapters dédiés. La route `[slug]/route.ts` tourne donc en **Edge Runtime** et ne parle qu'à **Redis** (REST, edge-friendly) pour résoudre le lien et rediriger le plus vite possible. En cas de cache miss, elle appelle une route Node interne (`/api/internal/resolve/[slug]`) qui interroge Prisma et réchauffe le cache. Le tracking du clic (géoloc, hash IP, parsing UA, écriture en base) est planifié via `after()` **après l'envoi de la réponse de redirection** : latence perçue par l'utilisateur = zéro overhead analytics.

## Démarrage

```bash
cp .env.example .env       # renseigner DATABASE_URL, Upstash, secrets
npm install
npm run db:push            # ou db:migrate en production
npm run db:seed            # utilisateur demo@linkforge.app / password123
npm run dev
```

## Variables d'environnement

Voir `.env.example` : `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`/`TOKEN`, `AUTH_SECRET`, `INTERNAL_API_SECRET`, `IP_HASH_SALT`, `NEXT_PUBLIC_APP_URL`.

## Modèle de données

Voir `prisma/schema.prisma` : `User`, `Preset`, `Link` (slug, UTM, `qrConfig` JSON, expiration, type de redirection), `Click` (timestamp, IP hashée, géoloc, device/OS/browser, `isUnique`), avec index composites pensés pour les requêtes d'agrégation du dashboard (`linkId+timestamp`, `linkId+isUnique`, `country`, `deviceType`...).
