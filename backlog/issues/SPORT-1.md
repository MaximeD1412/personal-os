---
id: SPORT-1
title: "Séances : prévu, réalisé et statut sur le même objet, présentes dans l'Agenda"
epic: SPORT
type: feature
priority: P0
size: M
milestone: M4 Agenda et sport
blocked_by: [SOCLE-3, UI-3]
adr: [0022, 0011, 0030]
risques: []
revue_visuelle: true
reprend: 10
---

## Contexte

Une **Séance** porte **à la fois** le prévu et le réalisé, plus un statut (ADR 0022). Une sortie non planifiée est une Séance créée déjà réalisée, sans prévu ; une Séance manquée garde son prévu, sans réalisé. Pas d'objet « résultat ». Le sport est personnel : **Espace personnel** uniquement.

## État actuel du code

- Imite `packages/api/src/app/calendar/` ; contributeur d'Agenda `event-agenda.contributor.ts`.

## À faire

- Prisma : `TrainingSession { id, scopeId, startsAt, sport (RUN | BIKE | SWIM | STRENGTH | OTHER), status (PLANNED | DONE | MISSED), plannedDistanceM Int?, plannedDurationS Int?, plannedIntent String?, actualDistanceM Int?, actualDurationS Int?, actualNotes String?, goalId String?, createdAt }`.
- Routes : `GET /training-sessions?from&to`, `POST /training-sessions` (statut `PLANNED` avec prévu, ou `DONE` avec réalisé), `PATCH /training-sessions/:id` (prévu et réalisé, jamais le statut), `POST /training-sessions/:id/complete` (`{ actual… }`, statut `DONE`), `POST /training-sessions/:id/miss` (statut `MISSED`, prévu conservé). Codes d'erreur `training.*` (ex. `training.already_done` en 422).
- `@Espaces('PERSONAL')` : chaque Compte ne voit que ses Séances.
- `TrainingSessionAgendaContributor`.
- Écrans : `/sport` (liste par semaine, écart prévu/réalisé champ par champ), `/sport/seances/nouvelle` (préremplie par URL), `/sport/seances/:id`.
- Semeur de démo : une semaine de séances pour chaque Compte, dont une manquée et une non planifiée.

## Décisions déjà prises

- Maquette : `sport-1424.png`, `sport-390.png` dans `design/captures/ecrans/` (frames `k7UxE`, `o4lfKt` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- Distances en mètres, durées en secondes (entiers) ; l'allure se calcule à l'affichage.

## Critères d'acceptation

- [ ] Une séance non planifiée se crée directement réalisée.
- [ ] Une séance manquée garde son prévu.
- [ ] Les séances apparaissent dans l'Agenda de leur seul propriétaire.
- [ ] Socle de tests de l'ADR 0030, cas 404 cross-Espace compris.

## Vérification

- `pnpm exec nx test-integration api -- training agenda` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /sport '/sport/seances/nouvelle?sport=RUN&plannedDistanceM=10000'`.

## Pour la prod

Rien.

## Hors périmètre

- Objectif et séances en série : SPORT-2.

## Dépendances

- SOCLE-3, UI-3.
