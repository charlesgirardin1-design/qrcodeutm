# Photothèque — Croix-Rouge française, UL Boulogne-Billancourt

Application web pour centraliser, importer, consulter, rechercher, filtrer, trier, télécharger et supprimer les photos et vidéos de l'unité locale.

> **Règle n° 1 : les originaux ne sont jamais modifiés.** Le fichier importé est stocké octet pour octet (même format, même extension, même résolution, même qualité). Les miniatures et aperçus sont des fichiers **séparés**, utilisés uniquement pour l'affichage. Chaque téléchargement, individuel ou en ZIP, renvoie l'original. Les tests automatisés le vérifient par empreinte SHA-256.

---

## 1. Stack et choix techniques

Le dépôt contenait déjà une application Next.js 15 / Prisma / PostgreSQL / Tailwind (LinkForge, à la racine). La photothèque reprend **la même stack** (et les mêmes composants d'interface) dans le dossier autonome `phototheque/`, sans toucher à l'application existante.

| Besoin | Choix |
|---|---|
| Framework | **Next.js 15** (App Router, Route Handlers), **TypeScript** strict, **React 18** |
| Interface | **Tailwind CSS** + primitives Radix (style shadcn/ui), icônes lucide |
| Base de données | **PostgreSQL** via **Prisma** (migrations versionnées) |
| Stockage des fichiers | Abstraction `StorageDriver` : **disque local** (dev, VPS, Docker) ou **S3 compatible** (Scaleway, OVH, AWS, Cloudflare R2, MinIO…) |
| Sessions | JWT HS256 signé (`jose`) dans un cookie `httpOnly`, `SameSite=Lax`, `Secure` en production |
| Dates EXIF | `exifr` dans le navigateur (lecture seule) ; date des vidéos MP4/MOV lue dans l'atome `mvhd` |
| Miniatures | Générées dans le navigateur (canvas → WebP/JPEG ; HEIC via `heic2any` sur une **copie**) ; à défaut, côté serveur avec `sharp` |
| ZIP | `client-zip` en flux, **méthode STORE (aucune compression)** |

### Choix raisonnables pris faute de précision dans le cahier des charges

- **Envoi direct de l'original** : le navigateur envoie les octets bruts du fichier (`PUT`, sans formulaire multipart ni ré-encodage). Avec S3, l'envoi va directement au bucket (URL pré-signée) : aucune limite de taille de requête de l'hébergeur, vidéos de plusieurs Go acceptées (4 Go par défaut).
- **Comptes partagés → comptes individuels** : chaque mot de passe global correspond à un `User` en base (« Bénévole », « Administrateur »). Les médias référencent déjà un `User` (importé par, trié par). Passer à des comptes individuels = ajouter un `AuthProvider` (`src/lib/auth/providers.ts`), sans migration des médias.
- **Nom affiché** : le compte admin étant partagé, chaque admin peut indiquer son prénom dans *Paramètres* ; il est enregistré comme « trié par ».
- **Historique** : chaque média conserve un **instantané** du nom de catégorie et d'activité au moment de l'importation (`categoryName`, `activityName`) **en plus** des identifiants. Renommer une activité ne réécrit donc pas l'historique, et le filtrage par catégorie/activité continue de fonctionner. Une catégorie/activité utilisée ne peut pas être supprimée (contrainte `RESTRICT` en base + contrôle API) : on la désactive.
- **Photos privées** : miniatures et originaux ne sont jamais publics ; chaque accès passe par une route authentifiée (et, avec S3, par une URL signée de courte durée).
- **Anti force brute** : 8 échecs de connexion en 15 min depuis une même IP → blocage temporaire. Le mot de passe USER `9205` ne contient que 4 chiffres : **il est recommandé de le remplacer par un mot de passe plus long** (simple changement de variable d'environnement).

---

## 2. Architecture

```
phototheque/
├── prisma/
│   ├── schema.prisma                 # User, Category, Activity, Media, AuditEvent, LoginAttempt
│   ├── migrations/…/migration.sql    # migration SQL initiale
│   └── seed.ts                       # comptes partagés + catégories/activités initiales (idempotent)
├── src/
│   ├── middleware.ts                 # 1re barrière (Edge) : redirections selon session/rôle
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── roles.ts              # rôles → permissions (USER : media:upload ; ADMIN : tout)
│   │   │   ├── token.ts              # JWT de session (compatible Edge)
│   │   │   ├── providers.ts          # AuthProvider : mots de passe globaux (remplaçable)
│   │   │   ├── session.ts            # getSession / requirePagePermission (serveur)
│   │   │   └── rate-limit.ts         # limitation des tentatives de connexion
│   │   ├── api.ts                    # withAuth(permission, handler) : authN + authZ + CSRF + erreurs
│   │   ├── storage/                  # types.ts, local.ts, s3.ts, index.ts (choix du driver)
│   │   ├── media/
│   │   │   ├── formats.ts            # formats acceptés (photo/vidéo), détection
│   │   │   ├── keys.ts               # clés de stockage : originals/… ≠ derivatives/…
│   │   │   ├── thumbnails.ts         # génération serveur des dérivés (sharp, sur copie)
│   │   │   ├── filters.ts            # filtres / recherche / tri → requêtes Prisma
│   │   │   ├── service.ts            # suppression sûre, changement de statut
│   │   │   ├── stream.ts             # diffusion (Range vidéo, URL signées S3)
│   │   │   └── serialize.ts          # DTO envoyé au client
│   │   ├── client/                   # navigateur : EXIF, miniatures, envoi avec progression
│   │   ├── catalog.ts  stats.ts  audit.ts  dates.ts  validations.ts  config.ts
│   ├── app/
│   │   ├── login/                    # page de connexion
│   │   ├── logout/route.ts           # purge d'une session invalide
│   │   ├── (app)/import/             # USER + ADMIN
│   │   ├── (app)/dashboard/          # ADMIN
│   │   ├── (app)/phototheque/        # ADMIN
│   │   ├── (app)/categories/         # ADMIN
│   │   ├── (app)/parametres/         # ADMIN
│   │   └── api/…                     # voir tableau ci-dessous
│   └── components/                   # import/, library/, catalog/, settings/, layout/, ui/
├── scripts/
│   ├── make-fixtures.mjs             # génère des fichiers de test (JPEG avec EXIF, PNG, HEIC, MOV…)
│   └── e2e.test.ts                   # 23 tests de bout en bout (API + base + stockage réels)
├── Dockerfile  docker-compose.yml  vercel.json  .env.example
```

### Routes API et permissions (vérifiées côté serveur)

| Route | Méthode | Rôle |
|---|---|---|
| `/api/auth/login` · `/api/auth/logout` | POST | public |
| `/api/auth/profile` (nom affiché) | PATCH | connecté |
| `/api/categories` (actives, formulaire d'import) | GET | USER, ADMIN |
| `/api/categories?all=1`, `POST /api/categories`, `/api/categories/[id]` (PATCH, DELETE), `/api/categories/reorder` | | ADMIN |
| `/api/activities` (POST), `/api/activities/[id]` (PATCH, DELETE), `/api/activities/reorder` | | ADMIN |
| `/api/uploads` (déclaration), `/api/uploads/[id]/[variant]` (PUT, driver local), `/api/uploads/[id]/complete`, `DELETE /api/uploads/[id]` (annulation) | | USER, ADMIN |
| `/api/media` (liste paginée), `/api/media/ids` (tout sélectionner), `GET /api/media/[id]`, `/api/media/[id]/file` (miniature, aperçu, lecture) | GET | ADMIN |
| `PATCH /api/media/[id]` (statut, métadonnées) | PATCH | ADMIN |
| `DELETE /api/media/[id]` (suppression définitive) | DELETE | ADMIN |
| `/api/media/[id]/download` (original) | GET | ADMIN |
| `/api/media/download` (ZIP des originaux) | POST | ADMIN |
| `/api/media/bulk` (statut ou suppression en masse) | POST | ADMIN |
| `/api/maintenance` | GET, POST | ADMIN |

Un USER qui appelle `DELETE /api/media/123` reçoit **403**, quel que soit l'affichage côté client.

### Cycle d'importation

1. **Navigateur** : détection du format (refus des fichiers non compatibles), lecture de la date EXIF / vidéo (préremplie, modifiable), génération d'une miniature (480 px) et d'un aperçu (1920 px) **à partir d'une copie décodée**.
2. `POST /api/uploads` : validation (format, taille, catégorie ↔ activité actives), création du média **PENDING / À TRIER**, renvoi des URL d'envoi.
3. `PUT` de l'**original inchangé** (progression affichée), puis des deux dérivés.
4. `POST /api/uploads/[id]/complete` : le serveur vérifie la présence et la **taille exacte** de l'original, génère les dérivés avec `sharp` s'ils manquent, puis passe le média en **READY** (visible dans la photothèque).
5. En cas d'échec, le fichier est marqué en erreur, l'importation partielle est nettoyée, les autres fichiers continuent et un bouton « Réessayer » apparaît.

### Suppression sans suppression partielle

1. Le média passe en `DELETING` (masqué).
2. Dérivés puis original sont supprimés du stockage (un fichier déjà absent compte comme supprimé).
   Si le stockage échoue : le média est restauré, rien n'est perdu, message « Impossible de supprimer ce média. Veuillez réessayer. »
3. La ligne est supprimée de la base. Si la base échoue après la suppression des fichiers, le média reste masqué en `DELETING` et la suppression peut être relancée depuis *Paramètres → Maintenance* (opération idempotente).

---

## 3. Installation locale

Prérequis : **Node.js ≥ 18.18** (20 ou 22 recommandé), **PostgreSQL ≥ 14**.

```bash
cd phototheque
cp .env.example .env              # puis renseignez AUTH_SECRET (openssl rand -base64 48)
npm install

# Base de données (exemple avec PostgreSQL local)
createuser -P photo               # mot de passe : photo
createdb -O photo phototheque
# ou : docker run -d --name pg -e POSTGRES_USER=photo -e POSTGRES_PASSWORD=photo -e POSTGRES_DB=phototheque -p 5432:5432 postgres:16

npm run db:deploy                 # applique les migrations (prisma migrate deploy)
npm run db:seed                   # catégories/activités initiales + comptes partagés
npm run dev                       # http://localhost:3000
```

Connexion : mot de passe USER → page *Importer des médias* ; mot de passe ADMIN → *Tableau de bord*.

### Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | oui | URL PostgreSQL |
| `AUTH_SECRET` | oui | secret de signature des sessions (≥ 16 caractères, idéalement 48+ aléatoires) |
| `USER_PASSWORD` / `ADMIN_PASSWORD` | oui* | mots de passe globaux (secrets serveur, jamais envoyés au navigateur) |
| `USER_PASSWORD_HASH` / `ADMIN_PASSWORD_HASH` | non | empreintes bcrypt, **prioritaires** sur les mots de passe en clair (recommandé) |
| `STORAGE_DRIVER` | non | `local` (défaut) ou `s3` |
| `LOCAL_STORAGE_DIR` | non | dossier du stockage local (défaut `./storage`) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | si `s3` | stockage objet |
| `MAX_UPLOAD_SIZE_MB` | non | taille max. par fichier (défaut 4096) |
| `SESSION_HOURS_USER` / `SESSION_HOURS_ADMIN` | non | durée de session (défaut 168 h / 12 h) |
| `APP_TIMEZONE` | non | fuseau des statistiques et filtres (défaut `Europe/Paris`) |
| `COOKIE_SECURE` | non | forcer/désactiver le cookie `Secure` (défaut : activé en production) |

\* ou leur version `_HASH`. Générer une empreinte :
`node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'MotDePasse'`

Changer un mot de passe **déconnecte automatiquement** les sessions existantes du rôle concerné.

---

## 4. Base de données

- Schéma : `prisma/schema.prisma` ; migration SQL : `prisma/migrations/20261001113204_init/migration.sql`.
- Appliquer les migrations : `npm run db:deploy` (production) ou `npm run db:migrate` (développement, crée une nouvelle migration si le schéma change).
- Seed : `npm run db:seed`. Il est **idempotent** : il crée les deux comptes partagés et n'insère les catégories initiales **que si la table est vide** (il ne recrée jamais ce qu'un admin a supprimé ou renommé). Il est donc exécuté sans risque à chaque déploiement.
- Catégories initiales : US (Poste de secours, DPS, Autre) · AS (Maraude, EBP, Saintaniste, DALO, ALSO, Autre) · Activité de transfert (JM, Muguet, Forme activité, Banque alimentaire, Autre) · **Autre (Formation, Autre)**.

## 5. Stockage

### Local (`STORAGE_DRIVER=local`)
Les fichiers sont écrits dans `LOCAL_STORAGE_DIR` :
```
storage/originals/AAAA/MM/<id>/<nom-original.EXT>   ← originaux, intouchés
storage/derivatives/<id>/thumbnail-xxx.webp          ← miniatures (affichage)
storage/derivatives/<id>/preview-xxx.webp            ← aperçus (affichage)
```
Écriture atomique (fichier temporaire puis renommage), empreinte SHA-256 enregistrée. **Ce dossier doit être sur un volume persistant et sauvegardé.** Ne convient pas à Vercel (système de fichiers éphémère).

### S3 compatible (`STORAGE_DRIVER=s3`) — recommandé en production
1. Créez un bucket **privé** (ex. Scaleway Object Storage, région `fr-par`, hébergement en France).
2. Créez une clé d'accès limitée à ce bucket ; renseignez les variables `S3_*`.
3. Configurez le **CORS** du bucket pour autoriser l'envoi direct depuis le navigateur :
```json
[
  {
    "AllowedOrigins": ["https://votre-domaine.fr"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
(`aws s3api put-bucket-cors --bucket <bucket> --cors-configuration file://cors.json --endpoint-url <endpoint>`)
4. Pour MinIO ou certains fournisseurs : `S3_FORCE_PATH_STYLE=true`.

---

## 6. Lancement en local (production)

```bash
npm run build
npm start                     # http://localhost:3000
```

Avec Docker (base + application + volume de stockage) :
```bash
AUTH_SECRET=$(openssl rand -base64 48) docker compose up -d --build
```
Les migrations et le seed s'exécutent au démarrage du conteneur. Les volumes `pgdata` (base) et `mediadata` (fichiers) doivent être sauvegardés. Placez un reverse proxy HTTPS (Caddy, Nginx, Traefik) devant le port 3000.

## 7. Déploiement

### Option A — Vercel + PostgreSQL managé + S3 (recommandé)
1. Base : Neon, Supabase, Scaleway Managed PostgreSQL…
2. Stockage : bucket S3 (section 5).
3. Sur Vercel : *New Project* → ce dépôt → **Root Directory = `phototheque`**.
4. Variables d'environnement : `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD_HASH`/`USER_PASSWORD_HASH` (ou en clair), `STORAGE_DRIVER=s3`, `S3_*`, `APP_TIMEZONE`.
5. `vercel.json` utilise `npm run vercel-build` : `prisma generate` → `prisma migrate deploy` → seed idempotent → `next build`.
6. Les envois vont directement au bucket (pas de limite de 4,5 Mo de Vercel). Les ZIP sont générés en flux par une fonction (`maxDuration = 300 s` : nécessite un plan Pro pour les très grosses sélections ; sinon, téléchargez par lots).

### Option B — Serveur / VPS avec Docker
`docker compose up -d --build` (section 6), stockage local sur volume ou S3.

---

## 8. Tests

```bash
# serveur démarré (npm run build && npm start) et base migrée + seedée
node scripts/make-fixtures.mjs
BASE_URL=http://localhost:3000 npm run test:e2e
```
Les 23 tests utilisent l'API, la base et le stockage réels : connexion et rôles, **403 sur toutes les routes ADMIN pour USER**, importation photo/vidéo/HEIC, refus des formats incompatibles et des fichiers tronqués, **originaux identiques au SHA-256 près** (téléchargement individuel et ZIP), miniatures séparées, lecture vidéo par plages, recherche/filtres/dates, tri et statistiques, catégories/activités dynamiques et historique, **suppression physique** des fichiers, suppression multiple, anti force brute.

### Checklist de validation

- [x] Login USER (`USER_PASSWORD`) → *Importer des médias*
- [x] Login ADMIN (`ADMIN_PASSWORD`) → *Tableau de bord*
- [x] USER ne peut accéder à aucune page ni route ADMIN (403 / redirection)
- [x] Import de photos (JPG, PNG, HEIC/HEIF, WEBP, RAW…) et de vidéos (MP4, MOV, …), glisser-déposer, sélection multiple, aperçu, retrait avant validation, progression « Importation : X / N », erreurs par fichier, « Réessayer »
- [x] Fichiers non compatibles refusés : « Ce fichier n'est pas compatible. »
- [x] Métadonnées enregistrées (photographe, catégorie, activité, date, auteur de l'import)
- [x] Date EXIF récupérée et préremplie (modifiable) ; date vidéo MP4/MOV
- [x] Statut initial À TRIER (rouge) ; passage à TRIÉE (vert) avec date et auteur
- [x] Statistiques calculées en base, mises à jour après tri/suppression ; bouton « X médias à trier → »
- [x] Recherche (nom, photographe, activité, catégorie) ; filtres statut, type, catégorie, activité dynamique, photographe, date précise / période / mois / année ; tri
- [x] Catégories et activités : créer, renommer, désactiver, supprimer si inutilisées, réorganiser ; « Formation » dans « Autre »
- [x] Miniatures séparées ; originaux intacts ; téléchargement = original ; ZIP = originaux non compressés
- [x] Suppression ADMIN avec confirmation, suppression réelle des fichiers ; suppression multiple avec nombre exact ; USER ne peut pas supprimer
- [x] Responsive : ordinateur (barre latérale, grande grille), tablette, smartphone (navigation basse, grille 2 colonnes, import depuis la galerie)
- [x] Données persistées dans PostgreSQL

### Limites connues
- Les miniatures de vidéos et de HEIC sont produites par le navigateur qui importe ; si celui-ci ne sait pas décoder le fichier (ex. HEVC sur certains navigateurs, RAW), une icône remplace la miniature. **L'original est toujours conservé et téléchargeable.**
- Un ZIP est limité à 2 000 fichiers ; la sélection « Tout sélectionner » à 10 000 médias.
