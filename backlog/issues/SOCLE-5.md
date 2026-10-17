---
id: SOCLE-5
title: "Lint : interdire le SQL brut dans les modules métier"
epic: SOCLE
type: chore
priority: P1
size: S
milestone: M0 Outillage agents et staging
blocked_by: []
adr: [0028]
risques: [SEC-1]
revue_visuelle: false
---

## Contexte

L'ADR 0028 note que la garde d'Espace ne couvre pas les requêtes SQL brutes, retirées de la façade `PrismaService`. Une règle de lint empêche qu'un agent les réintroduise par un autre chemin.

## État actuel du code

- `packages/database/src/lib/prisma.service.ts` : façade cloisonnée.
- `eslint.config.mjs` à la racine, `packages/api/eslint.config.mjs`.

## À faire

- Règle `no-restricted-syntax` dans la config ESLint de `packages/api` : interdire les appels `$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe` et l'import de `@prisma/client` (seul `@personal-os/database` est permis), avec le message « SQL brut et client Prisma nu interdits dans l'API : la garde d'Espace ne les couvre pas (ADR 0028). ».
- Ajouter la cible `lint` à `packages/api` si elle manque.

## Décisions déjà prises

- Aucune exception dans l'API ; un besoin réel passera par un accès technique dédié dans `packages/database`, décidé par ADR.

## Critères d'acceptation

- [ ] `pnpm exec nx lint api` échoue sur un fichier qui appelle `$queryRaw`.
- [ ] Le code actuel passe le lint.

## Vérification

- `pnpm exec nx lint api`.

## Pour la prod

Rien.

## Hors périmètre

- Les écritures imbriquées : SOCLE-6.

## Dépendances

Aucune.
