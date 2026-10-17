---
id: CUISINE-15
title: "Machine à Tours de génération : on ne relance que quand chaque repas est statué"
epic: CUISINE
type: feature
priority: P0
size: S
milestone: M3 Cuisine boucle
blocked_by: [CUISINE-7]
adr: [0030]
risques: []
revue_visuelle: false
---

## Contexte

Un **Tour de génération** : l'IA propose, l'utilisateur statue sur **chacun** des repas (approuvé ou refusé), puis relance ; le tour suivant ne régénère que les refusés ; le planning est arrêté quand tout est approuvé. On ne régénère jamais un repas isolé au fil de l'eau. Module profond du PRD : `(Planning, décisions) → état suivant`.

## État actuel du code

- `MealPlan.status`, `MealPlanEntry.decision` (`APPROVED | PROPOSED | REFUSED`) (CUISINE-7).

## À faire

- Prisma : `GenerationRound { id, scopeId, mealPlanId, number Int, createdAt, traceId String? }` ; `MealPlanEntry.generationRoundId String?`.
- Module profond `generation/tours.ts` (pur) : `peutLancerUnTour(planning)` (aucun repas `PROPOSED`, au moins un `REFUSED` ou un créneau à remplir), `creneauxDuTour(planning, creneauxDemandes)` (les créneaux des refusés, plus les créneaux demandés encore vides au premier tour), `appliquerDecision(entree, decision)` (seul un `PROPOSED` se décide), `estArretable(planning)`.
- Routes : `POST /meal-plans/:id/entries/:entryId/decision` (`{ decision: APPROVED | REFUSED }`, 422 `food.entry_not_proposed`) ; à l'arrêt (`POST /meal-plans/:id/stop`, CUISINE-7), les entrées `REFUSED` sont supprimées.

## Décisions déjà prises

- Un repas refusé reste visible (barré) jusqu'au tour suivant, qui le remplace.

## Critères d'acceptation

- [ ] Relancer est refusé tant qu'un repas est `PROPOSED`.
- [ ] Le tour suivant ne porte que sur les créneaux des refusés.
- [ ] Le planning est arrêtable quand tout est approuvé.

## Vérification

- `pnpm exec nx test api -- tours` ; `pnpm exec nx test-integration api -- meal-plan` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Rien.

## Hors périmètre

- L'appel à l'IA : CUISINE-16. L'écran : CUISINE-17.

## Dépendances

- CUISINE-7.
