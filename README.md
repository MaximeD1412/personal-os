# Personal OS

Application web privée qui centralise l'organisation personnelle et du foyer,
et publie un **Portfolio** public bilingue.

Le vocabulaire du domaine fait autorité : voir [`CONTEXT.md`](CONTEXT.md) et les
décisions d'architecture dans [`docs/adr/`](docs/adr).

Les sauvegardes et le déploiement font partie du produit : voir
[`infra/backup/`](infra/backup) et [`infra/deploy/`](infra/deploy). Le proxy de
tête de la machine, commun à tous les projets qui y tournent, vit dans
[`infra/edge/`](infra/edge).
L'hébergement cible est un homelab personnel, et les contraintes à connaître
avant d'y basculer sont rassemblées dans
[`docs/migration-homelab.md`](docs/migration-homelab.md).

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

## Intégration continue et livraison

Une campagne unique,
[`.github/workflows/verify.yml`](.github/workflows/verify.yml), lint, construit,
passe les tests unitaires puis les tests d'intégration sur base jetable. Elle est
appelée par les deux workflows, et c'est ce qui rend vraie la phrase « rien n'est
publié sans avoir passé exactement les mêmes tests qu'une PR ».

| Workflow | Déclencheur | Ce qu'il fait |
| --- | --- | --- |
| [`ci.yml`](.github/workflows/ci.yml) | PR, push sur `develop` | Vérification, et construction des images |
| [`livraison.yml`](.github/workflows/livraison.yml) | push sur `main` | Vérification, publication sur GHCR, déplacement du canal |

**`main` est une branche de livraison** : un commit qui l'atteint part en
production ([ADR 0023](docs/adr/0023-deploiement-automatique-tire-par-le-vps.md)).
Il n'y a pas de « je pousse pour sauvegarder mon travail » sur cette branche.

La livraison s'arrête à GHCR : GitHub n'a **aucun accès entrant** au serveur.
C'est un agent installé sur la machine qui détecte la nouvelle version et
l'applique — voir [`infra/deploy/`](infra/deploy).
