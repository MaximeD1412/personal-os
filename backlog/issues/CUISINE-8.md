---
id: CUISINE-8
title: "Stock domestique : une ligne par Ingrédient, recaleur, écran éditable en quelques secondes"
epic: CUISINE
type: feature
priority: P0
size: M
milestone: M2 Cuisine socle
blocked_by: [CUISINE-2]
adr: [0013, 0030]
risques: [CUI-1]
revue_visuelle: true
reprend: 19
---

## Contexte

Le **Stock domestique** est quantitatif et **déclaratif** (ADR 0013) : une ligne par Ingrédient en Unité canonique, avec la date de péremption la plus proche. Trois voies de recalage seulement : clôture de liste (CUISINE-10), Repas cuisiné (CUISINE-11), édition manuelle (ce ticket). Un stock faux est un incident normal, corrigé à la main.

## État actuel du code

- `Ingredient`, convertisseur (CUISINE-2).

## À faire

- Prisma : `PantryItem { id, scopeId, ingredientId (unique par scopeId), quantity Decimal (≥ 0), expiresOn Date?, updatedAt }`.
- Module profond `stock/recaler.ts` (pur) : `recaler(ligne | null, mouvement) → { ligne, manque? }` avec `mouvement` = `ACHAT { quantite, expireLe? }` (ajoute ; péremption = la plus proche des deux), `CONSOMMATION { quantite }` (retire ; jamais sous zéro : rend `manque` = la part non couverte), `CORRECTION { quantite, expireLe? }` (remplace). Une ligne à zéro perd sa péremption.
- Routes : `GET /pantry-items` (tout le stock, avec l'Ingrédient), `PUT /pantry-items/:ingredientId` (correction manuelle, crée la ligne au besoin), `DELETE /pantry-items/:ingredientId`.
- Écran `/repas/stock` : tableau éditable en place (quantité, péremption), recherche, ajout d'un Ingrédient ; ligne qui périme dans les trois jours mise en avant (`DccmStatusBadge` warning). Une modification s'enregistre à la sortie du champ, sans bouton.
- Semeur de démo : une dizaine de lignes, dont deux qui périment bientôt.

## Décisions déjà prises

- « Périme bientôt » = dans les trois jours (jour civil de Paris, `aujourdhui()`).
- L'édition en place sans bouton est la seule exception à `DccmFormPage` : c'est l'exigence « en quelques secondes » du PRD.

## Critères d'acceptation

- [ ] Racheter un Ingrédient en stock garde la péremption la plus proche.
- [ ] Une consommation supérieure au stock ramène la ligne à zéro et rend le manque, sans quantité négative.
- [ ] Socle de tests de l'ADR 0030.

## Vérification

- `pnpm exec nx test api -- recaler` ; `pnpm exec nx test-integration api -- pantry` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /repas/stock`.

## Pour la prod

Rien.

## Hors périmètre

- Clôture de liste : CUISINE-10. Repas cuisiné : CUISINE-11.

## Dépendances

- CUISINE-2.
