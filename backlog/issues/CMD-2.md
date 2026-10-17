---
id: CMD-2
title: "Résolveur d'intention et journal des commandes non comprises"
epic: CMD
type: feature
priority: P0
size: M
milestone: M5 Tableau de bord et barre de commande
blocked_by: [CMD-1, CUISINE-14]
adr: [0018, 0030]
risques: [SEC-6, IA-2]
revue_visuelle: false
reprend: 24
---

## Contexte

Module profond du PRD : `(phrase, catalogue) → action préremplie | échec explicite`. La barre **prépare** une action, elle ne l'exécute **jamais** ; elle ne répond jamais par une phrase. Une ambiguïté (« cette occurrence ou toute la série ? ») est posée dans le formulaire, jamais devinée. Une phrase non comprise est journalisée **telle quelle** : ce journal est la file de travail du catalogue.

## État actuel du code

- Catalogue généré (CMD-1), port `GenerateurIA` (CUISINE-14), contrats zod des entrées.

## À faire

- `command-bar/resolution/resoudre.ts` : construit la demande au modèle (catalogue, date du jour à Paris, phrase), sortie structurée `{ actionId, params } | { aucune: true, plusProche?: actionId }` ; valide `params` par le schéma d'entrée de l'action (paramètre invalide retiré et signalé, jamais appliqué) ; produit `{ screen, query }` (l'URL préremplie).
- Route `POST /command-bar/resolve` (`{ text }`) → `{ kind: 'action', url, ignored: string[] } | { kind: 'none', nearestUrl? }`.
- Prisma : `UnresolvedCommand { id, scopeId, text, createdAt }` (Espace personnel de l'auteur) ; écrit à chaque `none` ; `GET /command-bar/unresolved?cursor=` (journal, curseur).
- Le résolveur n'appelle jamais une route d'écriture : il ne connaît que des URL de formulaires.

## Décisions déjà prises

- Une question (« combien ai-je dépensé en juillet ? ») se résout comme une action qui ouvre l'écran filtré, si une telle action est annotée ; sinon `none`.

## Critères d'acceptation

- [ ] Une phrase connue rend l'URL attendue (double IA).
- [ ] Une phrase hors catalogue rend `none` et est journalisée mot pour mot.
- [ ] Aucune écriture métier n'a lieu lors d'une résolution (vérifié en base).
- [ ] Socle de tests de l'ADR 0030.

## Vérification

- `pnpm exec nx test api -- resolution` ; `pnpm exec nx test-integration api -- command-bar` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Rien (clé IA de CUISINE-14).

## Hors périmètre

- L'interface : CMD-3.

## Dépendances

- CMD-1, CUISINE-14.
