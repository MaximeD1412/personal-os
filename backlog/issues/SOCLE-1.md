---
id: SOCLE-1
title: "Contrats zod : nestjs-zod, pipe global, formes de valeur et fuseau de référence"
epic: SOCLE
type: chore
priority: P0
size: S
milestone: M0 Outillage agents et staging
blocked_by: []
adr: [0030]
risques: [AG-2]
revue_visuelle: false
---

## Contexte

L'ADR 0030 fait des schémas zod de `@personal-os/contracts` la seule définition d'un contrat. Ce ticket pose l'outillage et les formes de valeur ; la migration des modules existants est SOCLE-3.

## État actuel du code

- `packages/contracts/src/lib/*.ts` : des interfaces TypeScript seules (`event.ts`, `agenda.ts`, `scope.ts`, `auth.ts`, `health.ts`, `trace.ts`).
- Aucune dépendance zod, aucun pipe global ; la validation est écrite à la main dans les services (`packages/api/src/app/calendar/event.service.ts`, fonctions `texteRequis`, `instantRequis`…).
- `packages/api/src/app/app.module.ts` : module racine.

## À faire

- Ajouter `zod` (v4) et `nestjs-zod` aux dépendances (catalogue pnpm de la racine), versions exactes.
- `packages/contracts/src/lib/valeurs.ts` :
  - `zInstant` : chaîne ISO-8601 avec `Z` (`z.iso.datetime()`), exposée en chaîne ;
  - `zDay` : `YYYY-MM-DD` valide (`z.iso.date()`) ;
  - `zWeek` : un `zDay` qui tombe un lundi (message « Une semaine se désigne par son lundi. ») ;
  - `zCents` : entier positif ou nul ; `zMoney` = `{ cents: zCents, currency: z.literal('EUR').default('EUR') }` ;
  - `FUSEAU = 'Europe/Paris'` et deux fonctions pures : `aujourdhui(fuseau = FUSEAU, maintenant = new Date()): string` (un `zDay`) et `lundiDe(jour: string): string`.
- Pipe global : `{ provide: APP_PIPE, useClass: ZodValidationPipe }` dans `AppModule`.
- `packages/contracts` : tests unitaires (`jest`, cible `test` à ajouter au `project.json` si absente) des quatre formes et des deux fonctions, changement d'heure compris (dernier dimanche d'octobre et de mars).

## Décisions déjà prises

- Les formes de valeur ne sont **que** dans `valeurs.ts` ; aucun module n'en redéfinit.
- Les dates restent des chaînes dans les contrats ; la conversion en `Date` se fait au bord du dépôt (repository), pas dans le contrat.

## Critères d'acceptation

- [ ] `zWeek` refuse un mardi et accepte un lundi.
- [ ] `aujourdhui()` rend le bon jour civil à Paris à 23 h 30 UTC et à 00 h 30 UTC, y compris les nuits de changement d'heure.
- [ ] Le pipe global est actif (un DTO zod sur une route de test refuse un body invalide en 400).

## Vérification

- `pnpm exec nx test contracts` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Rien.

## Hors périmètre

- L'enveloppe d'erreur : SOCLE-2. La migration de `events` et `agenda` : SOCLE-3.

## Dépendances

Aucune.
