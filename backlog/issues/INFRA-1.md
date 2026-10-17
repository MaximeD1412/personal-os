---
id: INFRA-1
title: "agent-loop partagé entre projets : config par dépôt, prompts génériques, revue visuelle et pilotage"
epic: INFRA
type: chore
priority: P0
size: M
milestone: M0 Outillage agents et staging
blocked_by: []
adr: []
risques: [AG-1, AG-2, AG-3, AG-5, AG-6, SEC-5]
revue_visuelle: false
hors_boucle: true
---

## Contexte

La boucle d'agents de TGR (`scripts/agent-loop.sh` : Claude implémente, Codex relit, merge automatique du commit approuvé) doit servir à tous les projets, sans copie par dépôt. Personal OS l'adopte avec un merge automatique sur `develop` sans relecture humaine, sauf pour les tickets à revue visuelle. Ce ticket modifie des fichiers **hors de ce dépôt** (`~/dotfiles`, TGR) : il se fait en session interactive, pas par la boucle elle-même.

## État actuel du code

- `~/projects/TGR/TGR MON REPO/scripts/agent-loop.sh` (21 Ko) et ses prompts `scripts/agent-loop/{implement,review,fix-review,fix-ci,fix-conflict}.md`, `review-schema.json`. Les prompts nomment « The Gamer Rich », `CLAUDE.md`, les workspaces npm et l'artifact MEP de TGR.
- Codex est trouvé par `find_codex()` (binaire de l'app Windows sous `/mnt/c/Users/*/.codex/bin/wsl/`). Claude est lancé en `claude -p --permission-mode bypassPermissions --output-format json` (≥ 2.1.302 : Artifact et ArtifactData disponibles en headless).
- `ready-issues.sh` de `pick-issue` (`~/dotfiles/agents/skills/pick-issue/scripts/`) fournit l'ordre des tickets.

## À faire

- Déplacer le script et ses prompts dans `~/dotfiles/agents/tools/agent-loop/` (lien `~/.agents/tools/agent-loop`), lancés depuis n'importe quel dépôt par `agent-loop` (lien dans `~/.local/bin`).
- Configuration par dépôt dans `.agent-loop.conf` à la racine (format `clé=valeur`, sourcé) : `PROJECT_NAME`, `BASE_BRANCH` (défaut `develop`), `SETUP_CMD` (ex. `scripts/worktree.sh setup`), `DROP_CMD`, `CONVENTIONS_FILE` (défaut `AGENTS.md`), `PILOTAGE_PUBLISH_CMD` (vide = rien), `EXTRA_IMPLEMENT_PROMPT` (chemin d'un fragment de prompt propre au projet, vide par défaut).
- Prompts génériques : ils nomment `{{PROJECT_NAME}}` et renvoient à `{{CONVENTIONS_FILE}}` pour les conventions, les commandes de vérification et la règle de décision ; ils ne contiennent plus rien de propre à un projet.
- Revue visuelle : un ticket portant le label `revue-visuelle` suit tout le circuit (implémentation, revue Codex, CI), puis la boucle s'arrête **avant le merge**, commente « en attente de revue visuelle » sur la PR et passe au ticket suivant. Au passage suivant (`--wait` ou relance), une PR approuvée (`gh pr view --json reviewDecision` = `APPROVED`) est mergée ; une PR avec des changements demandés reprend en correction comme une revue Codex.
- Pilotage : après la réservation d'un ticket et après chaque merge, lancer `PILOTAGE_PUBLISH_CMD` sous le verrou global de la boucle ; un échec de publication est journalisé, jamais bloquant.
- TGR : ajouter son `.agent-loop.conf` avec un `EXTRA_IMPLEMENT_PROMPT` qui garde l'étape actuelle de mise à jour de l'artifact MEP TGR, puis remplacer `scripts/agent-loop.sh` par un appel à l'outil partagé (TGR garde ses artifacts actuels).
- Personal OS : ajouter `.agent-loop.conf` (`PROJECT_NAME="Personal OS"`, `SETUP_CMD="scripts/worktree.sh setup"`, `DROP_CMD="scripts/worktree.sh drop"`, `PILOTAGE_PUBLISH_CMD` vide tant que le pilotage n'est pas branché) et `.agent-loop/` dans `.gitignore`.
- README court dans `~/dotfiles/agents/tools/agent-loop/README.md` : options, config, label `revue-visuelle`, arrêt propre (`touch .agent-loop/stop`).

## Décisions déjà prises

- Pas de réécriture : l'algorithme de TGR (verrous, tours de revue, `needs-human`, attente des limites d'usage, reprise par `--issue`) est conservé tel quel ; seuls les points nommés ci-dessus changent.
- L'état reste dans `.agent-loop/` du dépôt principal (comme aujourd'hui), jamais dans dotfiles.
- `blocked.md` reste la sortie d'un agent qui ne peut pas trancher (règle de décision de `AGENTS.md`).

## Critères d'acceptation

- [ ] `agent-loop --dry-run` liste les mêmes tickets qu'avant dans TGR, et les tickets `ready-for-agent` de Personal OS.
- [ ] Aucun prompt partagé ne contient « TGR », « Gamer » ni « Personal OS ».
- [ ] Un ticket `revue-visuelle` s'arrête avant le merge, puis est mergé une fois la PR approuvée.
- [ ] `PILOTAGE_PUBLISH_CMD` est appelé après réservation et après merge, sous verrou ; son échec ne bloque pas la boucle.
- [ ] TGR fonctionne avec l'outil partagé, artifact MEP compris.

## Vérification

- `agent-loop --dry-run` dans TGR et dans Personal OS.
- Un ticket factice dans un dépôt de test (`gh repo create --private`), mené jusqu'au merge, puis un second avec le label `revue-visuelle`.

## Pour la prod

Rien.

## Hors périmètre

- Le pilotage lui-même (script `pilotage`) : livré avec la conception, branché par `PILOTAGE_PUBLISH_CMD`.
- `pick-issue` : INFRA-2.

## Dépendances

Aucune.
