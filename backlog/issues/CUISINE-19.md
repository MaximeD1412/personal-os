---
id: CUISINE-19
title: "Garder une recette générée appréciée"
epic: CUISINE
type: feature
priority: P2
size: S
milestone: M3 Cuisine boucle
blocked_by: [CUISINE-17]
adr: [0030]
risques: []
revue_visuelle: true
---

## Contexte

Une recette générée appréciée doit pouvoir revenir. Les recettes générées retenues sont stockées en `source: GENERATED` (CUISINE-16) ; les garder les fait figurer dans « Mes recettes ».

## État actuel du code

- `Recipe.source` (CUISINE-5), écran de génération (CUISINE-17), `/repas/recettes`.

## À faire

- `Recipe.kept Boolean` (défaut `false` pour `GENERATED`, `true` pour `MANUAL`) ; `POST /recipes/:id/keep`.
- `GET /recipes` ne liste par défaut que les recettes gardées (`?all=true` pour toutes) ; la génération propose en priorité les recettes gardées.
- Bouton « Garder la recette » sur un repas approuvé issu d'une recette générée, et sur le détail de recette.

## Décisions déjà prises

- Une recette générée non gardée n'apparaît pas dans « Mes recettes » mais reste consultable depuis le planning.

## Critères d'acceptation

- [ ] Une recette gardée apparaît dans « Mes recettes » et est proposée en priorité aux tours suivants.

## Vérification

- `pnpm exec nx test-integration api -- recipe` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /repas/recettes`.

## Pour la prod

Rien.

## Hors périmètre

Aucun.

## Dépendances

- CUISINE-17.
