---
id: CUISINE-16
title: "Génération IA du planning, avec contrôle déterministe des allergies hors du modèle"
epic: CUISINE
type: feature
priority: P0
size: M
milestone: M3 Cuisine boucle
blocked_by: [CUISINE-14, CUISINE-15, CUISINE-18, FOYER-2, CUISINE-8]
adr: [0013, 0030]
risques: [IA-1, IA-2, IA-3, SEC-6]
revue_visuelle: false
reprend: 16
---

## Contexte

L'IA propose les repas d'un tour en tenant compte des **Préférences alimentaires des Participants** de chaque repas, des **Souhaits** et du **Stock domestique** (privilégier ce qui reste et ce qui périme bientôt). **Le seul risque de santé du produit** (IA-1) : un plat contenant un allergène d'un Participant. La garantie n'est **jamais** le prompt : chaque repas proposé est contrôlé par l'application, hors du modèle.

## État actuel du code

- Port `GenerateurIA` (CUISINE-14), machine à Tours (CUISINE-15), Souhaits (CUISINE-18), `contraintesDuRepas` (FOYER-2), résolveur (CUISINE-3), stock (CUISINE-8), recettes (CUISINE-5).

## À faire

- Route `POST /meal-plans/:id/generation-rounds` : `{ slots?: { day, moment, participantIds, guestCount }[] }` (créneaux à remplir au premier tour) ; refus 422 `food.round_not_allowed` si `peutLancerUnTour` est faux.
- Construction de la demande : pour chaque créneau, ses participants et leurs contraintes (`contraintesDuRepas`), les Souhaits de la semaine non encore honorés, le stock (avec péremptions proches en tête), les recettes du Foyer (titres et ingrédients), les repas déjà approuvés (pour varier).
- Sortie structurée (schéma zod `zPropositionDeRepas[]`) : pour chaque créneau, soit `recipeId` d'une recette existante, soit une recette nouvelle (`title`, `servings`, `steps`, `ingredients: { label, quantity, unit }[]`).
- **Contrôle déterministe** (`generation/controler.ts`, pur) : chaque ingrédient d'une proposition est résolu (`resoudre`) ; un libellé inconnu rend la proposition **non contrôlable** ; une proposition dont un ingrédient porte un allergène interdit ou est un ingrédient interdit pour un participant est **rejetée**. Rejetée ou non contrôlable → elle n'est jamais présentée comme un repas proposé : le créneau reste vide et la raison est rendue (`rejected: { slot, reason, ingredient }[]`).
- Les propositions retenues deviennent des `MealPlanEntry` `PROPOSED` du tour ; une recette nouvelle est stockée comme `Recipe` `source: GENERATED` (une fois retenue).
- La trace IA (`traceId`) est liée au tour.

## Décisions déjà prises

- Une seule génération par tour ; les créneaux vidés par le contrôle seront redemandés au tour suivant.
- Les aversions (`DISLIKED`) vont dans le prompt comme « à éviter » et ne sont pas contrôlées ; allergies et exclusions le sont toujours.
- Les libellés inconnus ne créent jamais d'Ingrédient automatiquement.

## Critères d'acceptation

- [ ] Avec le double IA programmé pour proposer un plat aux noix, et un participant allergique aux fruits à coque, le plat est rejeté et le créneau reste vide, avec sa raison.
- [ ] Une proposition qui contient un libellé inconnu n'est pas présentée.
- [ ] L'allergie d'un **absent** du repas n'empêche pas la proposition.
- [ ] Un deuxième tour ne porte que sur les refusés.
- [ ] Socle de tests de l'ADR 0030 sur la route.

## Vérification

- `pnpm exec nx test api -- controler generation` ; `pnpm exec nx test-integration api -- generation-round` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Rien (la clé IA est posée par CUISINE-14).

## Hors périmètre

- L'écran : CUISINE-17. Sauvegarder une recette générée appréciée : CUISINE-19.

## Dépendances

- CUISINE-14, CUISINE-15, CUISINE-18, FOYER-2, CUISINE-8.
