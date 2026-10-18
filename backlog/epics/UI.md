---
id: EPIC-UI
title: "[EPIC] UI : design system Personal OS (pen.dev), Storybook, coque et motifs d'écran"
labels: [epic:ui]
reprend: 55
---

## Objectif

Transformer le design system conçu dans pen.dev (`design/`) en une bibliothèque de composants Angular fidèle aux maquettes, documentée dans Storybook, pour que chaque écran de module se compose au lieu de s'inventer. Les composants affichés dans Storybook sont exactement ceux qu'utilise l'application.

L'epic s'arrête au design system, à Storybook et à la coque. Les écrans des modules sont la mission suivante : UI-4 (Agenda, Calendrier) en est le premier exemple, puis les tickets de chaque module.

## Références

Dans cet ordre de priorité, en cas de contradiction :

1. `design/personalos.lib.pen` : la bibliothèque (48 masters, 59 variables), source de vérité visuelle.
2. `design/DESIGN.md` : règles graphiques et jetons.
3. `design/DESIGN-SYSTEM.md` : définition fonctionnelle des composants (props, variantes, slots).
4. `design/design-system.json` : ids pen.dev des masters et de leurs parties.
5. `design/personalos.pen` et ses exports `design/captures/ecrans/*.png` : composition des écrans.

`design/` est en lecture seule. Ses documents visent SvelteKit : la cible est Angular, Tailwind v4 et spartan/ui (ADR 0029). La traduction vit dans `docs/design-system.md`.

## Décisions

- ADR 0029 (Tailwind, spartan/ui), ADR 0030 (préremplissage par URL, affichage des erreurs), ADR 0018 (confirmation).
- Sombre seul en V1 : le design ne définit pas de thème clair, on n'en invente pas.

## Issues

Ordre : UI-1 → UI-5, UI-6 → UI-2, UI-3 → UI-4.
