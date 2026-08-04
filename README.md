# Personal OS

Application web privée qui centralise l'organisation personnelle et du foyer,
et publie un **Portfolio** public bilingue.

Le vocabulaire du domaine fait autorité : voir [`CONTEXT.md`](CONTEXT.md) et les
décisions d'architecture dans [`docs/adr/`](docs/adr).

## Démarrer

Tout part d'une seule commande :

```bash
docker compose up --build
```

| Service       | Adresse                 |
| ------------- | ----------------------- |
| Tableau de bord | http://localhost:4200 |
| Portfolio       | http://localhost:4201 |
| API             | http://localhost:3000/api |
| Base            | `localhost:5432`      |

Le tableau de bord affiche une valeur lue en base via l'API : c'est le fil
traceur qui prouve que les quatre couches se parlent.

### En développement

```bash
pnpm install              # génère aussi le client Prisma (postinstall)
cp .env.example .env
pnpm db:up                # la base seule, dans Docker
pnpm exec nx serve api        # http://localhost:3000/api
pnpm exec nx serve dashboard  # http://localhost:4200
pnpm exec nx serve portfolio  # http://localhost:4201
```

## Structure

Monorepo [Nx](https://nx.dev) :

| Paquet                  | Rôle                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `packages/api`          | API [NestJS](https://nestjs.com)                            |
| `packages/dashboard`    | Tableau de bord [Angular](https://angular.dev)              |
| `packages/portfolio`    | Portfolio public Angular, servi sur son propre hôte         |
| `packages/contracts`    | Types partagés entre l'API et les fronts — jamais dupliqués |
| `packages/database`     | Schéma [Prisma](https://prisma.io), migrations, accès aux données |

### Conventions posées ici

Le dépôt était vide avant cette tranche : ce qui suit fait jurisprudence.

- **Langue.** La prose, l'interface et les messages sont en français ; les
  identifiants de code (entités, champs, endpoints) sont en anglais
  ([`CONTEXT.md`](CONTEXT.md)).
- **Modules plats.** Un module démarre plat — contrôleur, service, accès aux
  données, DTO. Pas de découpage `application` / `domain` / `infrastructure`
  tant qu'il n'y a rien à y mettre
  ([ADR 0016](docs/adr/0016-modules-plats-et-filtrage-espace-centralise.md)).
- **Filtrage par Espace centralisé.** Aucun service n'ajoute « à la main » un
  filtre par **Espace** : la garantie de cloisonnement sera portée par une
  extension Prisma, dans `packages/database` (ADR 0016).
- **Contrats partagés.** Un type qui traverse le réseau vit dans
  `@personal-os/contracts` et nulle part ailleurs. Les contrats transitent en
  JSON : ils portent des dates ISO-8601, jamais de `Date`.
- **Migrations compatibles.** Une migration n'enlève jamais ce que la version
  précédente utilise encore ; revenir en arrière consiste uniquement à remettre
  les images précédentes
  ([ADR 0024](docs/adr/0024-migrations-toujours-compatibles-avec-la-version-precedente.md)).

## Tests

Deux campagnes, deux commandes.

```bash
pnpm test              # tests unitaires — aucune infrastructure requise
pnpm test:integration  # tests d'intégration — sur base jetable
```

Les tests unitaires (`*.spec.ts`) ne touchent ni base ni réseau : ils tournent
partout, tout de suite.

Les tests d'intégration (`*.integration-spec.ts`) tournent sur une base
**créée, migrée puis supprimée** pour la campagne. Aucun test ne s'exécute donc
sur une base partagée dont l'état viendrait d'ailleurs. Le serveur PostgreSQL
visé est celui de `TEST_DATABASE_URL`, ou à défaut `DATABASE_URL`.

```bash
pnpm db:up             # un serveur PostgreSQL doit être joignable
pnpm test:integration
```

## Base de données

```bash
pnpm prisma:migrate    # crée et applique une migration
pnpm prisma:generate   # régénère le client (fait au postinstall)
```

Le client généré (`packages/database/src/generated`) n'est pas versionné.

## Intégration continue

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) lint, construit, passe
les tests unitaires puis les tests d'intégration sur base jetable, et construit
les images Docker. Toute étape en échec fait échouer la CI.
