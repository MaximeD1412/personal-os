---
id: INFRA-2
title: "pick-issue sans current-issues.md : étapes MEP, risques, revue visuelle et captures"
epic: INFRA
type: chore
priority: P0
size: S
milestone: M0 Outillage agents et staging
blocked_by: []
adr: []
risques: [AG-3]
revue_visuelle: false
hors_boucle: true
---

## Contexte

`pick-issue` est le skill d'implémentation, en session comme dans la boucle (étape 5). Personal OS abandonne `current-issues.md` au profit du board et des relations natives « blocked by » ; les fichiers de pilotage (`docs/pilotage/*.json`) se mettent à jour dans la PR du ticket ; les tickets à revue visuelle exigent des captures. Ticket **hors de ce dépôt** (`~/dotfiles`), à faire en session interactive.

## État actuel du code

- `~/dotfiles/agents/skills/pick-issue/SKILL.md` : étape 1 lit `current-issues.md` en priorité ; étape 6 réécrit `current-issues.md` sur `chore/issue-tracking` ; étape 5 parle de « project checklists » sans les nommer.
- `scripts/ready-issues.sh` : lit `Blocked by #N` dans le corps uniquement ; trie déjà les jalons sans date sur leur numéro.

## À faire

- `ready-issues.sh` : lire aussi les relations natives « blocked by » (GraphQL `blockedBy` sur l'issue) en plus des lignes du corps.
- SKILL.md : `current-issues.md` devient facultatif (lu seulement s'il existe) ; l'étape 6 ne s'applique que s'il existe.
- Nouvelle étape « Pilotage », avant d'ouvrir la PR, si le dépôt a `docs/pilotage/` : renvoyer à la section « Les fichiers de pilotage » du fichier de conventions du projet (`AGENTS.md`) — MEP, risques cités dans le frontmatter, architecture.
- Revue visuelle : si le ticket porte `revue-visuelle`, produire les captures avec l'outil du projet (`scripts/captures.sh`, INFRA-10, s'il existe) et les joindre à la description de la PR.
- Fin de ticket : si le dépôt a `.pilotage.json`, lancer `pilotage publish` après le merge (ou après l'ouverture de la PR en session interactive), sans bloquer en cas d'échec.
- Lire le ticket complet, frontmatter compris (`adr`, `risques`, `revue_visuelle`), et lire les ADR cités avant d'implémenter.

## Décisions déjà prises

- Le skill reste générique : aucun nom de projet, tout passe par les fichiers du dépôt (`AGENTS.md`, `docs/pilotage/`, `scripts/`).

## Critères d'acceptation

- [ ] Sans `current-issues.md`, `pick-issue` propose les tickets disponibles de Personal OS en respectant les relations natives « blocked by ».
- [ ] Avec `current-issues.md` (TGR), le comportement est inchangé.
- [ ] Le skill nomme explicitement l'étape pilotage et l'étape captures.

## Vérification

- `ready-issues.sh --all` dans Personal OS (après création du backlog) et dans TGR.

## Pour la prod

Rien.

## Hors périmètre

- La boucle : INFRA-1. L'outil de captures : INFRA-10.

## Dépendances

Aucune.
