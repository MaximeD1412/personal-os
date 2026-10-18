---
id: PORTFOLIO-2
title: "Présentation publique par langue et État de publication"
epic: PORTFOLIO
type: feature
priority: P0
size: M
milestone: M6 Projets et portfolio
blocked_by: [PORTFOLIO-1]
adr: [0019, 0030]
risques: [SEC-2]
revue_visuelle: true
reprend: 95
---

## Contexte

Une **Présentation publique** est le texte d'un Projet destiné au portfolio, dans **une** langue, distinct des notes privées. Son **État de publication** passe par non publié → prêt à publier → publié. Un projet sans présentation anglaise est absent du portfolio anglais, sans repli.

## État actuel du code

- `Project` (PORTFOLIO-1).

## À faire

- Prisma : `PublicPresentation { id, scopeId, projectId, lang (FR | EN), title, summary, body (markdown), publicationState (UNPUBLISHED | READY | PUBLISHED), publishedAt?, updatedAt }`, unique `(projectId, lang)`.
- Routes : `PUT /projects/:id/presentations/:lang` (crée ou modifie ; ne change jamais l'état), `POST /projects/:id/presentations/:lang/ready`, `/publish` (depuis `READY` seulement : 422 `portfolio.not_ready`), `/unpublish`.
- Écran : onglet « Présentation publique » sur `/projets/:id`, un éditeur par langue, l'état et ses transitions (`DccmConfirm` pour publier et dépublier).

## Décisions déjà prises

- Maquette : `projets-1424.png`, `projets-390.png` dans `design/captures/ecrans/` (frames `EZy1P`, `XiIf0` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- Modifier une présentation publiée la repasse en `READY` : rien ne part en ligne sans un geste « Publier ».

## Critères d'acceptation

- [ ] La publication exige l'état « prêt à publier ».
- [ ] Modifier une présentation publiée la retire du portfolio jusqu'à republication.
- [ ] Socle de tests de l'ADR 0030.

## Vérification

- `pnpm exec nx test-integration api -- presentation` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /projets/<id>` (onglet présentation).

## Pour la prod

Rien.

## Hors périmètre

- Le portfolio public : PORTFOLIO-5.

## Dépendances

- PORTFOLIO-1.
