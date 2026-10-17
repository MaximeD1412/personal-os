---
id: PORTFOLIO-1
title: "Projets : notes, liens et dépenses dans l'Espace personnel"
epic: PORTFOLIO
type: feature
priority: P0
size: M
milestone: M6 Projets et portfolio
blocked_by: [UI-3]
adr: [0019, 0030]
risques: [SEC-2]
revue_visuelle: true
reprend: 21
---

## Contexte

Un **Projet** est un travail suivi dans l'application, avec ses notes, ses liens et ses dépenses. Il vit dans un **Espace personnel** et n'en sort jamais ; il peut porter une Présentation publique (PORTFOLIO-2). Publier un projet et le partager dans le Foyer sont deux axes distincts.

## État actuel du code

- Imite `packages/api/src/app/calendar/` ; `zMoney` (SOCLE-1).

## À faire

- Prisma : `Project { id, scopeId, title, notes String (markdown), links: { label, url }[] (Json), createdAt, updatedAt }` ; `ProjectExpense { id, scopeId, projectId, label, amountCents Int, currency, spentOn Date }`.
- Routes : `GET /projects`, `GET /projects/:id`, `POST /projects`, `PATCH /projects/:id`, `DELETE /projects/:id`, `POST /projects/:id/expenses`, `DELETE /projects/:id/expenses/:expenseId`. `@Espaces('PERSONAL')`.
- Écrans : `/projets`, `/projets/nouveau` (prérempli par URL : `title`), `/projets/:id` (notes, liens, dépenses et leur total).
- Semeur de démo : deux projets par Compte.

## Décisions déjà prises

- Les notes sont en markdown, rendues côté front ; elles ne sortent jamais vers le portfolio.

## Critères d'acceptation

- [ ] Un Compte ne voit jamais les projets de l'autre.
- [ ] Le total des dépenses est exact en centimes.
- [ ] Socle de tests de l'ADR 0030, cas 404 cross-Espace compris.

## Vérification

- `pnpm exec nx test-integration api -- project` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /projets /projets/<id>`.

## Pour la prod

Rien.

## Hors périmètre

- Présentation publique : PORTFOLIO-2.

## Dépendances

- UI-3.
