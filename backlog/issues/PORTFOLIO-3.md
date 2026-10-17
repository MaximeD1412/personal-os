---
id: PORTFOLIO-3
title: "Pages de contenu du portfolio, rédigées en français et en anglais"
epic: PORTFOLIO
type: feature
priority: P0
size: M
milestone: M6 Projets et portfolio
blocked_by: [UI-3]
adr: [0019, 0030]
risques: [SEC-2]
revue_visuelle: true
---

## Contexte

Une **Page de contenu** est le texte rédigé d'une page du portfolio (présentation, expériences, compétences), dans les deux langues, éditée depuis le tableau de bord. C'est de la prose : il n'existe ni entité Expérience, ni entité Compétence (ADR 0019). Les Pages de contenu sont globales (hors Espace, PRD).

## État actuel du code

- Aucun. Le portfolio (`packages/portfolio`) n'a pas encore de contenu.

## À faire

- Prisma : `PageContent { id, slug (about | experience | skills), lang (FR | EN), title, body (markdown), publicationState, updatedAt }`, unique `(slug, lang)`, hors Espace.
- Routes (privées) : `GET /page-contents`, `PUT /page-contents/:slug/:lang`, transitions `ready`, `publish`, `unpublish` comme PORTFOLIO-2.
- Écran `/portfolio/pages` : trois pages, deux langues côte à côte, aperçu du rendu.

## Décisions déjà prises

- Trois pages fixes en V1 : `about`, `experience`, `skills`.

## Critères d'acceptation

- [ ] Chaque page s'édite et se publie langue par langue.
- [ ] Socle de tests de l'ADR 0030 (modèle hors Espace : pas de cas cross-Espace).

## Vérification

- `pnpm exec nx test-integration api -- page-content` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /portfolio/pages`.

## Pour la prod

Rien.

## Hors périmètre

- Le portfolio public : PORTFOLIO-5.

## Dépendances

- UI-3.
