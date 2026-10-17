---
id: INFRA-8
title: "CD poussé par une clé SSH bridée : staging sur develop, prod sur main, minuteur retiré"
epic: INFRA
type: chore
priority: P0
size: M
milestone: M0 Outillage agents et staging
blocked_by: [INFRA-7]
adr: [0023, 0032]
risques: [SEC-3, AG-1, OPS-2]
revue_visuelle: false
---

## Contexte

L'ADR 0032 remplace le déclenchement tiré (minuteur sur le VPS) par un déclenchement poussé : GitHub Actions se connecte en SSH avec une clé bridée par une commande forcée, et le déploiement s'exécute pendant le job, dont le statut reflète le résultat. La séquence sur le VPS ne change pas.

## État actuel du code

- `infra/deploy/bin/deploy.sh` : séquence complète ; détecte la révision via le libellé `org.opencontainers.image.revision` de `api:main`.
- `infra/deploy/systemd/personal-os-deploy.{service,timer}`, `personal-os-deploy-failure@.service`, `bin/notify-failure.sh` : le minuteur et l'alerte d'échec.
- `infra/deploy/bin/install.sh` : pose l'agent et les unités, idempotent.
- `.github/workflows/livraison.yml` : sur `main`, vérification complète, construction et publication des images sur GHCR. `ci.yml` : sur `develop` et les PR.

## À faire

- `infra/deploy/bin/deploy-trigger` : la commande forcée. Lit `SSH_ORIGINAL_COMMAND`, n'accepte que `deploy <env> <sha>` avec `<env>` égal à l'environnement de la clé (passé en argument fixe dans `authorized_keys`) et `<sha>` de 40 caractères hexadécimaux ; refuse tout le reste avec un code non nul. Lance `deploy.sh <sha>` (prod) ou `deploy-staging.sh <sha>` (staging) sous `flock` (un seul déploiement à la fois par environnement) et recopie la sortie sur la sortie standard.
- `deploy.sh` accepte un `<sha>` explicite (sans argument : comportement manuel actuel, révision lue sur GHCR).
- `install.sh` : crée l'utilisateur `deploy` (shell `/usr/sbin/nologin`, membre du groupe `docker`), pose `authorized_keys` à partir de `deploy-keys/{prod,staging}.pub` fournies par l'opérateur, avec `command="/opt/personal-os/deploy/bin/deploy-trigger <env>",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,restrict` ; **retire** le minuteur et son service s'ils sont installés.
- Workflows :
  - `ci.yml`, push sur `develop` : après vérification, construire et pousser les images taguées `<sha>`, puis job `staging` (environnement GitHub `staging`, secret `STAGING_SSH_KEY`, variables `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`) qui lance `ssh deploy@$DEPLOY_HOST deploy staging $GITHUB_SHA`.
  - `livraison.yml`, push sur `main` : même chose vers l'environnement GitHub protégé `production` (secret `PROD_SSH_KEY`), une fois les images publiées.
  - `known_hosts` épinglé (pas de `StrictHostKeyChecking=no`).
- README de `infra/deploy/` : le sens de circulation devient poussé ; ce que la clé permet et ne permet pas ; rotation d'une clé.

## Décisions déjà prises

- Une clé par environnement ; la clé de prod n'est lisible que par l'environnement GitHub `production`, restreint à la branche `main`.
- L'alerte par courriel en cas d'échec (`notify-failure.sh`) est gardée, appelée par `deploy-trigger` en cas de code non nul.
- La répétition sur restauration reste dans `deploy.sh` (la clé Restic ne quitte pas la machine).

## Critères d'acceptation

- [ ] Une commande SSH autre que `deploy <env> <sha>` est refusée (testé : `ls`, `deploy prod $(sha)` avec la clé de staging, sha invalide).
- [ ] Un merge sur `develop` déploie le staging et le job est rouge si le déploiement échoue.
- [ ] Un merge sur `main` déploie la prod par la même séquence qu'avant (répétition, migration, santé, retour arrière).
- [ ] Plus aucun minuteur de déploiement après `install.sh`.

## Vérification

- `pnpm exec nx test deploy` et `pnpm exec nx test-integration deploy` : tests de `deploy-trigger` (arguments refusés et acceptés) sur le modèle de `infra/deploy/src/deploy.spec.ts`.
- `actionlint` sur les workflows modifiés si disponible, sinon relecture des expressions.

## Pour la prod

Ajouter à `docs/pilotage/mep.json` : générer les deux paires de clés, poser les `.pub` et relancer `install.sh` ; créer les environnements GitHub `staging` et `production` (règle de branche `main`), leurs secrets et variables ; vérifier que le port SSH est joignable depuis les runners.

## Hors périmètre

- La mise en service : INFRA-9.

## Dépendances

- INFRA-7.
