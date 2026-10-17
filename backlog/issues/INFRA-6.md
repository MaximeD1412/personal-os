---
id: INFRA-6
title: "Jeu de démo des trois Espaces, réinitialisable et enrichi par chaque module"
epic: INFRA
type: chore
priority: P0
size: S
milestone: M0 Outillage agents et staging
blocked_by: []
adr: [0014, 0031]
risques: [SEC-4, AG-1]
revue_visuelle: false
---

## Contexte

Le staging (ADR 0031) est réinitialisé à chaque déploiement à partir d'un jeu de démo, et les captures de revue visuelle s'appuient dessus. Il doit couvrir les trois Espaces, sinon le cloisonnement n'est jamais exercé hors des tests. Aucun jeu de démo n'existe aujourd'hui.

## État actuel du code

- `packages/database/prisma/schema.prisma` : `Household` (unique, posé par migration, id `11111111-1111-4111-8111-111111111111`), `Scope`, `User` (sujet OIDC), `Event`, `Trace`.
- Les écritures cloisonnées passent par la garde : un script doit ouvrir une portée comme une requête (`packages/database/src/lib/espace/portee.ts`), il n'existe pas de client Prisma nu (ADR 0028).
- Imite : la création de données des tests d'intégration (`packages/api/src/app/calendar/calendar.integration-spec.ts`).

## À faire

- `packages/database/src/demo/` : un point d'entrée `semer(prisma, comptes)` qui vide les données métier (jamais `Household`, `User`, `Session` réels) puis sème, module par module, via une liste de semeurs (`SEMEURS: Semeur[]`, un fichier par module : `calendar.ts` pour commencer).
- Les comptes de démo sont **les deux Comptes réels** désignés par `DEMO_ACCOUNT_EMAILS` (deux adresses, séparées par une virgule) : le semeur crée ou retrouve leurs `User` et leurs Espaces personnels, puis sème des données dans les deux Espaces personnels et l'Espace foyer.
- Calendrier : une dizaine d'Événements sur les quatre semaines autour d'aujourd'hui, dans les trois Espaces, dont une Échéance.
- Commande `pnpm demo:seed`, qui refuse de tourner si `APP_ENV` vaut `production`.
- Ajouter à `AGENTS.md` (section « Livrer un ticket ») : « un ticket qui ajoute un module ajoute son semeur ».

## Décisions déjà prises

- Données déterministes, relatives à la date du jour (pas de dates en dur).
- Pas de faux Comptes : les deux comptes réels admis par Authentik, pour que la connexion au staging montre leurs données.

## Critères d'acceptation

- [ ] `pnpm demo:seed` deux fois de suite donne le même état.
- [ ] Les trois Espaces portent des données après le semis.
- [ ] Refus explicite avec `APP_ENV=production`.

## Vérification

- `pnpm exec nx test database` (un test du semis sur base jetable, sur le modèle des tests d'intégration).
- `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Rien (le staging l'utilise : INFRA-7).

## Hors périmètre

- Le déclenchement au déploiement du staging : INFRA-7.

## Dépendances

Aucune.
