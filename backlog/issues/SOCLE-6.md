---
id: SOCLE-6
title: "Garde d'Espace : écritures imbriquées entre modèles cloisonnés"
epic: SOCLE
type: chore
priority: P0
size: M
milestone: M2 Cuisine socle
blocked_by: [SOCLE-3]
adr: [0028, 0016]
risques: [SEC-1]
revue_visuelle: false
---

## Contexte

L'ADR 0028 signale que la garde vérifie l'Espace de la charge écrite, pas celui des charges qu'elle contient : « le jour où une Recette portera ses Ingrédients, il faudra étendre l'inspection ». Les Recettes (CUISINE-5), les Plannings (CUISINE-7) et les listes de courses (CUISINE-9) écrivent leurs lignes par des créations imbriquées.

## État actuel du code

- `packages/database/src/lib/espace/cloisonnement.ts` : `cloisonner()`, `refuserLesCheminsImbriques()` (refuse les relations de `RELATIONS_VERS_ESPACE` depuis un modèle hors Espace), `verifierEcriture()`, `bornerAuxEspacesLisibles()`.
- `modeles.ts` : `MODELES_HORS_ESPACE`, `RELATIONS_VERS_ESPACE` ; `modeles-cloisonnes.spec.ts` relit ces listes contre le schéma.
- `cloisonnement.spec.ts` : tests unitaires de la garde.

## À faire

- Règle : **toute table cloisonnée porte `scopeId`**, lignes d'agrégat comprises (une ligne de Recette porte le même `scopeId` que sa Recette).
- Dans une écriture sur un modèle cloisonné, pour chaque relation vers un **autre modèle cloisonné** (déduite du schéma par le DMMF Prisma, pas d'une liste à la main) :
  - `create` et `createMany` imbriqués : la garde **pose** le `scopeId` du parent sur chaque charge imbriquée, et refuse (`ErreurDEspace` raison `imbrication`) une charge qui en porte un autre ;
  - `connect`, `connectOrCreate`, `set`, `update`, `updateMany`, `upsert`, `delete`, `deleteMany`, `disconnect` imbriqués vers un modèle cloisonné : **refusés** (raison `imbrication`), on les fait au premier niveau par le dépôt du modèle concerné ;
  - les relations vers un modèle hors Espace (ex. `Ingredient`, catalogue global) restent permises en `connect`.
- La récursion s'applique à toute profondeur.
- Ajouter `imbrication` à `RaisonDuRefus` et au filtre d'erreurs (SOCLE-2) : 500 `scope.nested_write` (défaut du code, pas de la requête).
- Mettre à jour l'ADR 0028 : remplacer le paragraphe « Les écritures imbriquées… il faudra étendre » par la règle ci-dessus (même fichier, mention « complété le … par SOCLE-6 »).

## Décisions déjà prises

- Pas de modèles « dépendants » sans `scopeId` : l'uniformité (toute table cloisonnée porte `scopeId`, le filtre s'applique partout) prime sur la redondance.
- Le graphe des relations est lu du DMMF à l'exécution, pour qu'un nouveau modèle soit couvert sans y penser.

## Critères d'acceptation

- [ ] Un `create` de parent avec lignes imbriquées pose le `scopeId` du parent sur chaque ligne.
- [ ] Une ligne imbriquée qui porte un autre `scopeId` est refusée.
- [ ] Un `connect` imbriqué vers un modèle cloisonné est refusé ; vers `Ingredient` (hors Espace), il passe.
- [ ] Les cas sont testés sur deux niveaux d'imbrication.

## Vérification

- `pnpm exec nx test database -- cloisonnement` (modèles de test du schéma de test, sur le modèle de `cloisonnement.spec.ts`) ; `pnpm exec nx test-integration api -- cloisonnement`.

## Pour la prod

Rien.

## Hors périmètre

- Le SQL brut : SOCLE-5.

## Dépendances

- SOCLE-3.
