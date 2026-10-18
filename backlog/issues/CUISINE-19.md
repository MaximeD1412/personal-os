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
reprend: 79
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

- Maquette : `recettes-ingredients-1424.png`, `recettes-ingredients-390.png` dans `design/captures/ecrans/` (frames `G2E7s`, `WgPSA` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
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
