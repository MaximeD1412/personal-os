---
id: UI-2
title: "Coque de l'application : navigation par groupes, sélecteur d'Espace, responsive"
epic: UI
type: feature
priority: P0
size: M
milestone: M1 UI
blocked_by: [UI-1]
adr: [0014, 0029]
risques: [AG-4]
revue_visuelle: true
---

## Contexte

`docs/design-system.md` décrit la coque DCCM et les regroupements de la navigation de Personal OS. Elle porte aussi l'affichage des Espaces atteignables, sans jamais filtrer côté front (le filtrage est une règle de l'API).

## État actuel du code

- `packages/dashboard/src/app/app.ts`, `app.html` : coque minimale ; `app.routes.ts`.
- `espace.service.ts` : lit les Espaces du Compte (`GET /scopes`).
- `auth.service.ts` : session, déconnexion.

## À faire

- `DccmShell` dans `packages/ui/dccm/` : barre latérale repliable (desktop), tiroir (mobile ≤ 768 px), zone d'en-tête réservée à la future barre de commande (vide pour l'instant), zone de contenu.
- Navigation de Personal OS, groupes et libellés de `docs/design-system.md` (Organisation : Agenda, Calendrier, Sport, Repas, Courses ; Gestion : Finances, Documents, Immobilier ; Professionnel : Projets, Documentation, Portfolio ; Système : Sauvegardes, Intégrations, Paramètres). Une entrée sans écran est affichée désactivée avec le badge « À venir ».
- Sélecteur de contexte : les Espaces atteignables (personnel, foyer), affichés pour information et pour pré-choisir l'Espace d'une création ; aucun filtrage côté front.
- Compte connecté et déconnexion dans la coque.

## Décisions déjà prises

- Les entrées « Finances », « Documents », « Immobilier », « Documentation », « Intégrations » sont hors V1 : toujours « À venir ».
- Ordre : Organisation, Gestion, Professionnel, Système.

## Critères d'acceptation

- [ ] La coque s'affiche correctement en 390 px et 1280 px.
- [ ] Chaque entrée active mène à son écran ; les entrées « À venir » ne sont pas cliquables.
- [ ] Le sélecteur ne liste que les Espaces renvoyés par l'API.

## Vérification

- `pnpm exec nx test dashboard` ; `pnpm exec nx test ui` si la cible existe ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /agenda /calendrier`.

## Pour la prod

Rien.

## Hors périmètre

- La barre de commande : CMD-3.

## Dépendances

- UI-1.
