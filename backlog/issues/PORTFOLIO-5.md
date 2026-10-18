---
id: PORTFOLIO-5
title: "Portfolio public : seulement le publié, langue du navigateur, sélecteur, aucun repli"
epic: PORTFOLIO
type: feature
priority: P0
size: M
milestone: M6 Projets et portfolio
blocked_by: [PORTFOLIO-2, PORTFOLIO-3]
adr: [0019, 0026, 0030]
risques: [SEC-2]
revue_visuelle: true
reprend: 22
---

## Contexte

Le **Portfolio** est le site public, unique, en français et en anglais. Langue initiale déduite de `Accept-Language` (jamais par géolocalisation IP), sélecteur toujours visible, choix mémorisé. Il ne lit que des contenus à l'état « publié ». Aucune note privée n'en sort ; un projet sans présentation anglaise est absent du portfolio anglais.

## État actuel du code

- `packages/portfolio` (Angular) ; API fermée par défaut, `@Public()` pour ouvrir une route (ADR 0026) ; `PublicPresentation`, `PageContent`, CV.

## À faire

- Routes publiques (`@Public()`) sous `/public` : `GET /public/:lang/pages/:slug`, `GET /public/:lang/projects`, `GET /public/:lang/projects/:id`, `GET /public/cv/:lang` ; schémas de sortie **dédiés** (`zPublicProject` ne contient ni notes, ni liens privés, ni dépenses, ni `scopeId`).
- Lecture : uniquement `PUBLISHED`, uniquement la langue demandée.
- Portfolio Angular : routes `/fr/…` et `/en/…` ; à la racine, redirection selon `Accept-Language` (rendu serveur ou page d'accueil qui lit `navigator.languages` : choisir le plus simple compatible avec le build actuel) ; sélecteur mémorisé (`localStorage`, protégé par `try/catch`).
- Tests du chemin public : rien de non publié ; aucune note privée ; projet sans anglais absent en anglais ; aucun champ d'Espace dans une réponse publique.

## Décisions déjà prises

- Maquette : `portfolio-public-1424.png`, `portfolio-public-390.png` dans `design/captures/ecrans/` (frames `Gs5bj`, `THiTg` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- Pas de repli d'une langue vers l'autre, jamais.

## Critères d'acceptation

- [ ] Les tests du chemin public listés ci-dessus passent.
- [ ] La langue initiale suit `Accept-Language`, et le sélecteur la change et la mémorise.

## Vérification

- `pnpm exec nx test-integration api -- public` ; `pnpm exec nx test portfolio` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures du portfolio (pas de session nécessaire) : `/fr`, `/en`, une page projet.

## Pour la prod

Rien.

## Hors périmètre

- La finition visuelle : PORTFOLIO-6.

## Dépendances

- PORTFOLIO-2, PORTFOLIO-3.
