---
id: INFRA-4
title: "CI économe : suite complète la nuit et sur la PR de livraison, suivi des minutes Actions"
epic: INFRA
type: chore
priority: P1
size: S
milestone: M0 Outillage agents et staging
blocked_by: []
adr: []
risques: [AG-1]
revue_visuelle: false
---

## Contexte

Les merges sur `develop` sont automatiques. La CI des PR ne rejoue que ce que le diff atteint ; il faut un filet qui rejoue tout régulièrement, et surveiller la consommation de minutes Actions, puisque les agents ouvrent beaucoup de PR.

## État actuel du code

- `.github/workflows/verify.yml` : campagne unique, entrée `portee` (`affectee` | `complete`).
- `ci.yml` (push `develop` et PR) appelle `verify.yml` en `affectee` ; `livraison.yml` (push `main`) en `complete`.
- Pas de nightly ni de suivi de minutes. Modèle : `~/projects/TGR/TGR MON REPO/.github/workflows/actions-minutes.yml` et `.github/scripts/actions-minutes.mjs` (+ test).

## À faire

- `nightly.yml` : chaque nuit (`cron: '30 3 * * *'`) sur `develop`, appelle `verify.yml` en `complete` ; `workflow_dispatch` aussi.
- PR vers `main` : `ci.yml` appelle `verify.yml` en `complete` quand `github.base_ref == 'main'`.
- `actions-minutes.yml` + `.github/scripts/actions-minutes.mjs` repris de TGR (échec à 80 % du quota mensuel, `ACTIONS_BILLING_TOKEN`, `ACTIONS_MINUTES_QUOTA`), avec son test `node --test`.
- Ajouter à `AGENTS.md` : « une nightly rouge se corrige en premier ».

## Décisions déjà prises

- Rien ne change pour les PR vers `develop` : toujours `affectee`.

## Critères d'acceptation

- [ ] La nightly rejoue la campagne complète et échoue visiblement si un test casse.
- [ ] Une PR vers `main` rejoue la campagne complète.
- [ ] Le suivi des minutes échoue au-delà du seuil.

## Vérification

- `node --test .github/scripts/` ; `actionlint` si disponible.

## Pour la prod

Ajouter à `docs/pilotage/mep.json` : créer le secret `ACTIONS_BILLING_TOKEN` (jeton fin, permission « Plan » en lecture) et la variable `ACTIONS_MINUTES_QUOTA`.

## Hors périmètre

- Le CD : INFRA-8.

## Dépendances

Aucune.
