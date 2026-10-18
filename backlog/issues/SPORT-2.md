---
id: SPORT-2
title: "Objectif sportif et Séances créées en série vers lui"
epic: SPORT
type: feature
priority: P1
size: M
milestone: M4 Agenda et sport
blocked_by: [SPORT-1]
adr: [0022, 0030]
risques: []
revue_visuelle: true
reprend: 100
---

## Contexte

Un **Objectif** (une course, une date, une intention) remplace la notion de plan (ADR 0022). On peut créer des Séances en série vers un Objectif, sans modèle de plan réutilisable.

## État actuel du code

- `TrainingSession.goalId` (SPORT-1).

## À faire

- Prisma : `TrainingGoal { id, scopeId, title, date (zDay), intent String?, createdAt }`, Espace personnel.
- Routes : `GET /training-goals`, `POST /training-goals`, `PATCH /training-goals/:id`, `DELETE /training-goals/:id` (les séances liées perdent le lien) ; `POST /training-goals/:id/sessions` (`{ weekdays, from, to, sport, planned… }` crée les séances `PLANNED` correspondantes, chacune liée à l'Objectif ; au plus 100).
- Écrans : `/sport/objectifs`, `/sport/objectifs/:id` (séances liées, avancement : faites / manquées / à venir), création en série.

## Décisions déjà prises

- Maquette : `sport-1424.png`, `sport-390.png` dans `design/captures/ecrans/` (frames `k7UxE`, `o4lfKt` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- Pas d'entité « semaine » ni « plan » : la série crée des séances indépendantes, modifiables une à une.

## Critères d'acceptation

- [ ] Une série crée les séances attendues, liées à l'Objectif.
- [ ] Socle de tests de l'ADR 0030, cas 404 cross-Espace compris.

## Vérification

- `pnpm exec nx test-integration api -- training` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /sport/objectifs`.

## Pour la prod

Rien.

## Hors périmètre

Aucun.

## Dépendances

- SPORT-1.
