---
id: FOYER-1
title: "Foyer : exposer les deux Comptes pour choisir les Participants"
epic: FOYER
type: feature
priority: P0
size: S
milestone: M2 Cuisine socle
blocked_by: [SOCLE-3]
adr: [0014, 0030]
risques: []
revue_visuelle: false
reprend: 14
---

## Contexte

Un **Participant** est un **Compte** attendu à un **Repas planifié** ; par défaut les deux participent. Les **Invités** ne comptent que pour les portions et n'ont pas de préférences (glossaire). Le planning (CUISINE-7) a besoin de la liste des Comptes du Foyer.

## État actuel du code

- Modèles `Household` (unique, posé par migration), `User` (`householdId`, `displayName`), `Scope`.
- `packages/api/src/app/espace/espace.controller.ts` : `GET /scopes`. Imite `packages/api/src/app/calendar/` pour la structure.

## À faire

- `contracts` : `zHousehold` = `{ id, name, members: { id, displayName }[] }`.
- `GET /household` dans un module `household` : le Foyer du Compte connecté et ses membres (`displayName`, à défaut la partie locale de l'e-mail). `User` et `Household` sont hors Espace : aucun `@Espaces` à déclarer pour lire ces deux modèles, mais la route n'expose ni e-mail ni sujet OIDC.
- Front : `household.service.ts` (transport, `httpResource`).
- Semeur de démo : rien à ajouter (les Comptes viennent de `DEMO_ACCOUNT_EMAILS`).

## Décisions déjà prises

- Pas d'écran Foyer dans ce ticket : la liste sert au choix des Participants (CUISINE-7) et aux Préférences (FOYER-2).

## Critères d'acceptation

- [ ] `GET /household` rend les deux Comptes du Foyer, sans e-mail.
- [ ] Socle de tests de l'ADR 0030 (nominal, 401 ; pas de 400 ni de 404, la route n'a ni entrée ni identifiant).

## Vérification

- `pnpm exec nx test-integration api -- household` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Rien.

## Hors périmètre

- Les Préférences alimentaires : FOYER-2.

## Dépendances

- SOCLE-3.
