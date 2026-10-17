---
id: CUISINE-6
title: "Saisie d'une Recette, avec rattachement des libellés inconnus"
epic: CUISINE
type: feature
priority: P0
size: M
milestone: M2 Cuisine socle
blocked_by: [CUISINE-5]
adr: [0030]
risques: [CUI-3]
revue_visuelle: true
---

## Contexte

L'utilisateur saisit ses ingrédients en texte libre (« 2 belles tomates », « 200 g de farine »). Chaque libellé doit aboutir à un Ingrédient : reconnu, rattaché à une suggestion (ce qui crée un Alias), ou créé.

## État actuel du code

- `POST /ingredients/resolve`, `POST /ingredient-aliases` (CUISINE-3) ; `POST /recipes` (CUISINE-5) ; motifs `DccmFormPage`, `DccmField` (UI-3).

## À faire

- Écrans `/repas/recettes/nouvelle` et `/repas/recettes/:id/modifier` : titre, portions de référence, étapes (liste ordonnée), lignes d'ingrédients (quantité, unité de `UNITES_DE_RECETTE`, libellé libre).
- À l'enregistrement : résoudre tous les libellés en un appel ; pour chaque inconnu, afficher en ligne ses suggestions, « Créer l'ingrédient » (ouvre la création préremplie, retour à la recette) ; un choix de suggestion crée l'Alias. L'enregistrement n'est possible que quand chaque ligne a un Ingrédient.
- Préremplissage par URL : `title`, `servings`.

## Décisions déjà prises

- Pas d'analyse de phrase (« 2 belles tomates » → quantité 2) : quantité, unité et libellé sont trois champs.

## Critères d'acceptation

- [ ] Une recette avec un libellé inconnu ne s'enregistre pas tant qu'il n'est pas rattaché.
- [ ] Rattacher à une suggestion crée l'Alias ; la saisie suivante du même libellé est reconnue sans question.

## Vérification

- `pnpm exec nx test dashboard` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh '/repas/recettes/nouvelle?title=Gratin&servings=4'`, plus une capture avec un libellé inconnu.

## Pour la prod

Rien.

## Hors périmètre

- Fusion d'Ingrédients : CUISINE-4.

## Dépendances

- CUISINE-5.
