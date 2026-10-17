---
id: INFRA-3
title: "scripts/worktree.sh : préparer et nettoyer un worktree d'agent"
epic: INFRA
type: chore
priority: P0
size: S
milestone: M0 Outillage agents et staging
blocked_by: []
adr: []
risques: [AG-5]
revue_visuelle: false
---

## Contexte

La boucle et `pick-issue` travaillent dans un worktree par ticket, frère du dépôt principal (`../personal-os-feat-<n>-<slug>`), et lancent `scripts/worktree.sh setup` juste après sa création. Plusieurs worktrees doivent pouvoir tester en même temps.

## État actuel du code

- Aucun script. Les tests d'intégration créent déjà une base jetable par exécution (`packages/api/test/global-setup.ts`, `infra/*/test/`), donc **aucune base dédiée** par worktree n'est nécessaire.
- Modèle : `~/projects/TGR/TGR MON REPO/scripts/worktree.sh` (npm, base dédiée : plus que ce qu'il faut ici).
- `.env` vit à la racine du dépôt principal (`.env.example` en modèle) ; `pnpm db:up` lance le Postgres de `docker-compose.yml`.

## À faire

- `scripts/worktree.sh setup` (dans un worktree, refuse le dépôt principal) :
  - copie les `.env*` non suivis du dépôt principal (sans écraser) ;
  - `pnpm install --frozen-lockfile --prefer-offline` (le store pnpm est partagé, l'installation est rapide) ;
  - `pnpm prisma:generate` ;
  - vérifie que Postgres répond sur `localhost:5432`, sinon lance `pnpm db:up` et attend.
- `scripts/worktree.sh drop` : rien à détruire côté base ; supprime les dossiers `dist/`, `.nx/cache` du worktree et affiche la commande `git worktree remove`.
- Script `bash` avec `set -euo pipefail`, messages en français, sortie non nulle et message clair à chaque échec.

## Décisions déjà prises

- Jamais de lien symbolique vers `node_modules` du dépôt principal.
- Pas de base par worktree : la base jetable par exécution des tests suffit.

## Critères d'acceptation

- [ ] Deux worktrees préparés en parallèle lancent `pnpm exec nx test-integration api` en même temps sans interférence.
- [ ] `setup` lancé deux fois de suite ne casse rien (idempotent).
- [ ] `setup` lancé dans le dépôt principal échoue avec un message clair.

## Vérification

- `git worktree add ../po-test -b chore/test origin/develop && (cd ../po-test && scripts/worktree.sh setup && pnpm exec nx test api)`, puis `drop` et `git worktree remove`.

## Pour la prod

Rien.

## Hors périmètre

- La boucle : INFRA-1.

## Dépendances

Aucune.
