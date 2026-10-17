---
id: CMD-1
title: "Catalogue d'actions généré au build depuis les endpoints annotés"
epic: CMD
type: feature
priority: P0
size: M
milestone: M5 Tableau de bord et barre de commande
blocked_by: [SOCLE-3]
adr: [0018, 0030]
risques: [SEC-6]
revue_visuelle: false
---

## Contexte

La barre de commande travaille sur un catalogue **fermé**, généré au build depuis les endpoints **explicitement annotés** ; un endpoint non annoté lui est invisible (ADR 0018). L'annotation produit une extension `x-command` de l'OpenAPI (ADR 0030). Module profond du PRD : `(OpenAPI + annotations) → catalogue typé`.

## État actuel du code

- OpenAPI généré par la cible `api:openapi` (SOCLE-3) ; formulaires préremplis par URL (ADR 0030).

## À faire

- Décorateur `@Command({ intent, examples: string[], screen: string, params: Record<champ, 'required' | 'optional'> })` sur un endpoint : `intent` en français (« Créer un Événement »), `screen` l'URL du formulaire du front (`/calendrier/evenements/nouveau`), `params` les champs du schéma d'entrée que la barre peut préremplir. Il ajoute `x-command` à l'opération OpenAPI.
- Générateur `packages/api/src/app/command-bar/catalogue/generer.ts` (pur) : `genererCatalogue(openapi) → Catalogue` (une action par opération annotée : `id`, `intent`, `examples`, `screen`, `params` avec leur schéma JSON) ; cible Nx `api:command-catalog` qui écrit `packages/contracts/src/generated/command-catalog.json`, exécutée avant le build du dashboard et de l'API (`dependsOn`).
- Un test structurel : une annotation dont `params` nomme un champ absent du schéma d'entrée fait échouer la génération.

## Décisions déjà prises

- Le catalogue est un fichier généré, versionné (pour que le front et l'API le lisent sans exécuter l'API) et vérifié en CI (régénéré puis comparé).

## Critères d'acceptation

- [ ] Un endpoint annoté apparaît dans le catalogue ; un endpoint non annoté n'y apparaît pas.
- [ ] Une annotation incohérente avec le schéma fait échouer la génération.

## Vérification

- `pnpm exec nx test api -- catalogue` ; `pnpm exec nx run api:command-catalog` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Rien.

## Hors périmètre

- La résolution d'intention : CMD-2. Les premières annotations : CMD-4.

## Dépendances

- SOCLE-3.
