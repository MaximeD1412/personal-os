---
id: SOCLE-3
title: "Ticket exemple : events et agenda migrés aux conventions, OpenAPI généré depuis les schémas"
epic: SOCLE
type: chore
priority: P0
size: M
milestone: M0 Outillage agents et staging
blocked_by: [SOCLE-2]
adr: [0030, 0011, 0018]
risques: [AG-2]
revue_visuelle: false
---

## Contexte

Ce ticket transforme les deux modules existants en **modèle à imiter** pour tous les suivants : contrats zod, pas de validation de forme dans les services, `ErreurMetier`, schéma de sortie, socle de tests de l'ADR 0030, et OpenAPI généré (base du catalogue de la barre de commande, ADR 0018). `GET /events` exige désormais une période.

## État actuel du code

- `packages/api/src/app/calendar/` : `event.controller.ts`, `event.service.ts` (validation manuelle, `BadRequestException`), `event.repository.ts`, `event-agenda.contributor.ts`, `calendar.integration-spec.ts`.
- `packages/api/src/app/agenda/` : `agenda.controller.ts`, `agenda.service.ts` (valide `from`/`to` à la main).
- `packages/contracts/src/lib/event.ts`, `agenda.ts` : interfaces.
- `packages/dashboard/src/app/event.service.ts` appelle `GET /events` sans période.

## À faire

- `contracts` : `zEvent`, `zEventInput`, `zEventUpdate` (= `zEventInput.partial()` sans aucun statut), `zEventListQuery` (`from`, `to` : `zInstant`, obligatoires), `zAgendaPeriod`, `zAgendaItem` ; les types sont `z.infer`. Supprimer les interfaces.
- API : DTO `createZodDto(...)`, `@ZodSerializerDto` sur chaque route ; `EventService` ne garde que les règles métier (`event.period_reversed` en 422, `event.not_found` en 404, `event.empty_update` en 422) ; `GET /events?from&to` (400 sans période).
- OpenAPI : `@nestjs/swagger` + `cleanupOpenApiDoc` de nestjs-zod ; document servi en `/api/openapi.json` hors production (`APP_ENV !== 'production'`) et écrit par une cible Nx `api:openapi` dans `packages/api/openapi.json` (non versionné, `.gitignore`).
- Tests d'intégration au socle de l'ADR 0030 pour chaque route de `events` et `agenda` (nominal conforme au schéma, 400 avec `fields`, 422 avec `code`, 404 cross-Espace en lecture et en écriture, 401).
- Front : `event.service.ts` passe une période ; l'écran Calendrier demande les Événements du mois affiché.
- `AGENTS.md` : la section « État actuel du code » des tickets pourra dire « imite `packages/api/src/app/calendar/` » ; ajouter cette phrase dans la section Conventions.

## Décisions déjà prises

- La période de l'écran Calendrier : du premier au dernier jour du mois affiché, à Paris.
- `openapi.json` n'est pas servi en production.

## Critères d'acceptation

- [ ] Plus aucune fonction de validation de forme dans `calendar/` et `agenda/`.
- [ ] `pnpm exec nx run api:openapi` produit un document qui décrit `events` et `agenda` avec leurs schémas.
- [ ] Le socle de tests de l'ADR 0030 couvre chaque route des deux modules.
- [ ] `GET /events` sans période renvoie 400.

## Vérification

- `pnpm exec nx test-integration api -- calendar agenda` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Rien.

## Hors périmètre

- Le front (intercepteur, affichage des erreurs, préremplissage) : SOCLE-4.

## Dépendances

- SOCLE-2.
