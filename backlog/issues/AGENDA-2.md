---
id: AGENDA-2
title: "Agir sur une occurrence ou sur toute la série, le choix étant toujours posé"
epic: AGENDA
type: feature
priority: P0
size: M
milestone: M4 Agenda et sport
blocked_by: [AGENDA-1, UI-4]
adr: [0018, 0030]
risques: []
revue_visuelle: true
---

## Contexte

L'utilisateur peut modifier ou supprimer **une seule occurrence** sans casser la règle, ou toute la série. Le choix lui est **explicitement posé**, jamais deviné (c'est aussi la règle de la barre de commande, ADR 0018).

## État actuel du code

- Moteur et `EventException` (AGENDA-1) ; écrans Calendrier au design system (UI-4).

## À faire

- Routes : `PATCH /events/:id/occurrences/:originalStart` (crée ou met à jour une exception `MODIFIED`), `DELETE /events/:id/occurrences/:originalStart` (exception `CANCELLED`) ; `PATCH /events/:id` et `DELETE /events/:id` agissent sur la série.
- Formulaire de récurrence sur la création et la modification d'un Événement (fréquence, intervalle, jours, fin par date ou par nombre).
- Sur une occurrence d'une série, « Modifier » et « Supprimer » ouvrent un choix obligatoire « Cette occurrence » / « Toute la série » (`DccmConfirm` à deux options) ; la page de modification d'une occurrence est `/calendrier/evenements/:id/occurrences/:originalStart`.

## Décisions déjà prises

- Pas d'option « cette occurrence et les suivantes » en V1.

## Critères d'acceptation

- [ ] Modifier une occurrence crée une exception sans changer la règle.
- [ ] Le choix occurrence ou série est posé à chaque fois.
- [ ] Socle de tests de l'ADR 0030 sur les routes d'occurrence.

## Vérification

- `pnpm exec nx test-integration api -- calendar` ; `pnpm exec nx test dashboard` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /calendrier` avec le choix ouvert sur une occurrence de démo.

## Pour la prod

Rien.

## Hors périmètre

Aucun.

## Dépendances

- AGENDA-1, UI-4.
