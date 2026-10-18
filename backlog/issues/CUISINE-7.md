---
id: CUISINE-7
title: "Planning de repas saisi à la main : Repas planifiés, Participants, Invités, présence dans l'Agenda"
epic: CUISINE
type: feature
priority: P0
size: M
milestone: M2 Cuisine socle
blocked_by: [CUISINE-5, FOYER-1]
adr: [0011, 0012, 0030]
risques: []
revue_visuelle: true
reprend: 15
---

## Contexte

Un **Planning de repas** regroupe les **Repas planifiés** d'une semaine. Un Repas planifié affecte une Recette (ou un simple intitulé) à un jour, un moment, des **Participants** (les deux Comptes par défaut) et des **Invités** ; les portions en découlent. Le planning est **arrêté** quand plus aucun repas n'attend de décision ; c'est d'un planning arrêté que se produit la liste de courses (CUISINE-9). Un Repas planifié n'est pas un Événement, mais il apparaît dans l'Agenda.

## État actuel du code

- `AgendaContributor` : `packages/api/src/app/agenda-port/` ; exemple `packages/api/src/app/calendar/event-agenda.contributor.ts`.
- `Recipe` (CUISINE-5), `GET /household` (FOYER-1), `zWeek`, `zDay` (SOCLE-1).

## À faire

- Prisma : `MealPlan { id, scopeId, week Date (lundi, unique par scopeId), status (OPEN | STOPPED), createdAt }` ; `MealPlanEntry { id, scopeId, mealPlanId, day Date, moment (LUNCH | DINNER), recipeId String?, title String?, participantIds String[], guestCount Int (≥ 0), decision (APPROVED | PROPOSED | REFUSED), createdAt }`, contrainte : recette ou intitulé.
- `contracts` : `zMealPlan` (avec ses entrées, `servings` calculé = participants + invités), `zMealPlanEntryInput`, `zMealPlanEntryUpdate`.
- Routes : `GET /meal-plans?week=` (le crée vide s'il n'existe pas), `POST /meal-plans/:id/entries` (une entrée saisie à la main est `APPROVED`), `PATCH /meal-plans/:id/entries/:entryId`, `DELETE /meal-plans/:id/entries/:entryId`, `POST /meal-plans/:id/stop` (422 `food.plan_has_pending` s'il reste un repas `PROPOSED`), `POST /meal-plans/:id/reopen`.
- Règles : le jour d'une entrée appartient à la semaine (422 `food.entry_out_of_week`) ; `participantIds` ⊂ membres du Foyer, non vide (422) ; un planning arrêté refuse toute modification d'entrée (422 `food.plan_stopped`).
- `MealPlanEntryAgendaContributor` : déjeuner à 12 h, dîner à 19 h 30, heure de Paris ; intitulé = titre de la recette ou intitulé.
- Écran `/repas/planning?semaine=YYYY-MM-DD` : grille sept jours × deux moments, ajout (recette ou intitulé, participants cochés par défaut, invités), arrêt et réouverture par `DccmConfirm`.
- Semeur de démo : le planning de la semaine courante, partiellement rempli.

## Décisions déjà prises

- Maquette : `planning-de-repas-1424.png`, `planning-de-repas-390.png` dans `design/captures/ecrans/` (frames `DjOyh`, `P0DQS` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- Heures d'affichage dans l'Agenda : 12 h 00 et 19 h 30.
- Rouvrir un planning arrêté est permis ; cela ne touche jamais une liste déjà produite (ADR 0012).

## Critères d'acceptation

- [ ] Les portions d'un repas valent participants + invités.
- [ ] Les Repas planifiés de la semaine apparaissent dans `GET /agenda`.
- [ ] Un planning avec un repas `PROPOSED` ne s'arrête pas.
- [ ] Socle de tests de l'ADR 0030.

## Vérification

- `pnpm exec nx test-integration api -- meal-plan agenda` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh '/repas/planning?semaine=<lundi courant>'`.

## Pour la prod

Rien.

## Hors périmètre

- Génération IA et Tours : CUISINE-15, CUISINE-16. Liste : CUISINE-9. Repas cuisiné : CUISINE-11.

## Dépendances

- CUISINE-5, FOYER-1.
