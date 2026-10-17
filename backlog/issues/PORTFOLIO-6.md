---
id: PORTFOLIO-6
title: "Portfolio : finition visuelle et performance"
epic: PORTFOLIO
type: feature
priority: P1
size: M
milestone: M6 Projets et portfolio
blocked_by: [PORTFOLIO-5]
adr: [0019, 0029]
risques: []
revue_visuelle: true
---

## Contexte

Le PRD veut un portfolio « agréable à regarder et rapide ». C'est la vitrine publique : la revue visuelle humaine y est déterminante.

## État actuel du code

- Portfolio fonctionnel (PORTFOLIO-5), design system (UI-1).

## À faire

- Mise en page soignée des pages et des projets (typographie, rythme, images des projets si présentes), cohérente avec le design system mais propre au portfolio public.
- Performance : score Lighthouse ≥ 95 en performance et accessibilité sur mobile pour `/fr` et une page projet ; images optimisées ; aucune dépendance lourde.
- Métadonnées : `title`, `description`, Open Graph par page et par langue, `hreflang`.

## Décisions déjà prises

- Pas de framework d'animation : CSS seul.

## Critères d'acceptation

- [ ] Lighthouse mobile ≥ 95 en performance et accessibilité sur les deux pages visées.
- [ ] Métadonnées et `hreflang` présents.

## Vérification

- `pnpm exec nx build portfolio` ; Lighthouse en local sur le build servi (`pnpm exec nx serve-static portfolio`).
- Captures des pages en 390 et 1280 px.

## Pour la prod

Rien.

## Hors périmètre

Aucun.

## Dépendances

- PORTFOLIO-5.
