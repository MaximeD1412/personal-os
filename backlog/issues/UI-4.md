---
id: UI-4
title: "Calendrier et Agenda passés au design system"
epic: UI
type: feature
priority: P1
size: S
milestone: M1 UI
blocked_by: [UI-2, UI-3]
adr: [0011, 0030]
risques: [AG-4]
revue_visuelle: true
---

## Contexte

Les deux écrans existants doivent devenir les premiers exemples d'écrans composés avec le design system : liste par période (Agenda), formulaire prérempli par URL (Calendrier).

## État actuel du code

- `packages/dashboard/src/app/agenda.ts`, `calendrier.ts` et leurs templates ; route `/calendrier/evenements/nouveau` (SOCLE-4).

## À faire

- Agenda : semaine courante par défaut, navigation semaine précédente / suivante, entrées groupées par jour, source de chaque entrée visible (`DccmStatusBadge`), `DccmState` pour chargement, vide et erreur.
- Calendrier : liste du mois, création et modification par `DccmFormPage` (`/calendrier/evenements/nouveau`, `/calendrier/evenements/:id`), suppression par `DccmConfirm`.

## Décisions déjà prises

- L'Agenda reste en lecture seule : une entrée renvoie vers l'écran de son module (ADR 0011).

## Critères d'acceptation

- [ ] Les deux écrans n'utilisent plus que des composants du design system et des jetons.
- [ ] Les tests existants des deux écrans passent, adaptés si besoin.

## Vérification

- `pnpm exec nx test dashboard` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /agenda /calendrier /calendrier/evenements/nouveau`.

## Pour la prod

Rien.

## Hors périmètre

- La récurrence : AGENDA-1, AGENDA-2.

## Dépendances

- UI-2, UI-3.
