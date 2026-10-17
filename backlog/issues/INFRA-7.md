---
id: INFRA-7
title: "Staging de démonstration : projet Compose séparé, plafonné, servi sous un sous-domaine"
epic: INFRA
type: chore
priority: P0
size: M
milestone: M0 Outillage agents et staging
blocked_by: [INFRA-6]
adr: [0025, 0027, 0031]
risques: [SEC-4, OPS-3, AG-1]
revue_visuelle: false
---

## Contexte

L'ADR 0031 ajoute un staging sur le VPS de production : projet Compose séparé, ressources plafonnées, servi par le proxy de tête sous un sous-domaine, protégé par Authentik, et rempli **uniquement** du jeu de démo, réinitialisé à chaque déploiement. Le déclenchement automatique (CD poussé) est INFRA-8 ; ce ticket livre de quoi faire tourner et (re)déployer le staging à la main.

## État actuel du code

- `infra/deploy/docker-compose.prod.yml` : un seul projet, services `db`, `db-init`, `authentik`, `authentik-worker`, `api`, `dashboard`, `portfolio`, `caddy`, `edge`, avec des `container_name` fixes (`personal-os-db`…) qui interdisent un second projet tel quel.
- `infra/deploy/caddy/Caddyfile` + `conf.d/{dashboard,authentik}.caddy` : la carte de routage interne par nom d'hôte. Le proxy de tête (`infra/edge/Caddyfile`) envoie déjà `*.{$PERSONAL_OS_DOMAIN}` au proxy interne : **aucun changement du proxy de tête**.
- `infra/deploy/bin/deploy.sh` : la séquence de la prod (répétition, migration, santé, retour arrière) ; `lib/common.sh` ses fonctions.
- `infra/deploy/stack.env.example` : modèle d'environnement.

## À faire

- `infra/deploy/docker-compose.staging.yml`, projet `personal-os-staging` : `db` (Postgres propre, volume `staging-db-data`), `api`, `dashboard`, `portfolio`, sans Authentik (il utilise celui de la prod, par un client OIDC dédié), sans `container_name`, sur un réseau propre ; `deploy.resources.limits` : 1 CPU et 1 Go au total, réparti par service.
- Routage : `infra/deploy/caddy/conf.d/staging.caddy` route `{$STAGING_DASHBOARD_HOST}` et `{$STAGING_PORTFOLIO_HOST}` vers les services du staging (réseau Docker externe partagé `personal-os-staging-edge`, auquel le caddy interne de la prod et les services exposés du staging se joignent).
- `infra/deploy/staging.env.example` : `APP_ENV=staging`, hôtes, `OIDC_*` du client de staging, `DEMO_ACCOUNT_EMAILS`, `DATABASE_URL` du Postgres de staging.
- Garde-fous dans l'API au démarrage : refus si `APP_ENV=staging` et que `DATABASE_URL` désigne l'hôte `db` du projet de prod ou la base de prod (comparaison à `PROD_DATABASE_HOST` posé dans l'environnement de staging), refus si `APP_ENV` est absent ou inconnu.
- `infra/deploy/bin/deploy-staging.sh <commit>` : tire les images du commit, migre la base de staging, la **réinitialise** avec `pnpm demo:seed` (exécuté dans l'image `api`), redémarre, vérifie la santé (`/api/health`). Pas de répétition sur restauration (pas de données réelles).
- README `infra/deploy/README.md` : section « Staging » (mise en service, arrêt `docker compose -p personal-os-staging stop`, ce qui est partagé et ce qui ne l'est pas).

## Décisions déjà prises

- Sous-domaines : `staging.<domaine>` pour le tableau de bord, `staging-portfolio.<domaine>` pour le portfolio (un seul niveau, couvert par le joker du proxy de tête).
- Le staging n'a jamais de copie de la prod, ni de sauvegarde : il est jetable.
- Même images que la prod, autre fichier d'environnement : aucune image propre au staging.

## Critères d'acceptation

- [ ] `deploy-staging.sh <commit>` met le staging à jour sans toucher un seul conteneur de la prod.
- [ ] Après déploiement, le staging montre exactement le jeu de démo.
- [ ] L'API de staging refuse de démarrer avec l'URL de base de la prod.
- [ ] `docker stats` montre les plafonds appliqués.

## Vérification

- `pnpm exec nx test deploy` et `pnpm exec nx test-integration deploy` (étendre `infra/deploy/src/deploy.spec.ts` sur le modèle des tests existants pour `deploy-staging.sh`).
- `docker compose -f infra/deploy/docker-compose.staging.yml config` valide.
- Test unitaire du garde-fou de démarrage de l'API.

## Pour la prod

Ajouter à `docs/pilotage/mep.json` : DNS `staging` et `staging-portfolio` (couverts par le joker existant, vérifier), client OIDC de staging dans Authentik (URI de redirection `https://staging.<domaine>/api/auth/callback`), fichier `staging.env` sur le VPS, création du réseau `personal-os-staging-edge`.

## Hors périmètre

- Le déclenchement depuis GitHub : INFRA-8. La mise en service réelle : INFRA-9.

## Dépendances

- INFRA-6.
