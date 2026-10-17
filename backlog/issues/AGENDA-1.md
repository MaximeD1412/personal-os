---
id: AGENDA-1
title: "Récurrence des Événements : règle, exceptions, occurrences calculées à la lecture"
epic: AGENDA
type: feature
priority: P0
size: M
milestone: M4 Agenda et sport
blocked_by: [SOCLE-3]
adr: [0011, 0030]
risques: []
revue_visuelle: false
reprend: 9
---

## Contexte

La récurrence d'un Événement se modélise en **règle + exceptions** (modèle iCalendar) ; les occurrences sont **calculées à la lecture**, jamais stockées. Un changement de règle se reflète immédiatement. Module profond du PRD : `(règle, exceptions, période) → occurrences`.

## État actuel du code

- `Event` (`startsAt`, `endsAt`, `category`, `reminderLeadMinutes`, `scopeId`) ; `packages/api/src/app/calendar/` aux conventions (SOCLE-3) ; `event-agenda.contributor.ts`.

## À faire

- Prisma : `Event.recurrence Json?` (`zRecurrence` : `{ freq: DAILY | WEEKLY | MONTHLY | YEARLY, interval ≥ 1, byWeekday?: (MO…SU)[], until?: zDay, count?: Int }`, au plus l'un de `until` et `count`) ; `EventException { id, scopeId, eventId, originalStart (instant de l'occurrence), kind (CANCELLED | MODIFIED), startsAt?, endsAt?, title? }`.
- Module profond `calendar/recurrence/occurrences.ts` (pur) : `occurrences(evenement, exceptions, periode) → Occurrence[]`, chaque occurrence portant `originalStart` (son identité). Calcul en heure de Paris (`FUSEAU`) : une réunion à 9 h reste à 9 h après le changement d'heure.
- `GET /events?from&to` rend les occurrences de la période (avec `eventId`, `originalStart`, `isRecurring`) ; l'Agenda les affiche par le contributeur existant.
- Contrats et socle de tests de l'ADR 0030 pour les champs nouveaux.

## Décisions déjà prises

- Pas de dépendance `rrule` : un moteur maison borné aux fréquences ci-dessus, entièrement testé.
- Une occurrence déplacée hors de la période demandée n'apparaît pas ; une occurrence déplacée **dans** la période depuis l'extérieur apparaît.

## Critères d'acceptation

- [ ] Tests du moteur : occurrence supprimée, occurrence déplacée hors de sa période et dans la période, changement de règle, bornes de période, changement d'heure (fin mars, fin octobre), `until` et `count`.
- [ ] L'Agenda affiche les occurrences de la période.

## Vérification

- `pnpm exec nx test api -- occurrences` ; `pnpm exec nx test-integration api -- calendar agenda` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Rien (migration additive).

## Hors périmètre

- Modifier une occurrence ou la série depuis l'écran : AGENDA-2.

## Dépendances

- SOCLE-3.
