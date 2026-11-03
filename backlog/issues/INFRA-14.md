---
id: INFRA-14
title: "/api/health donne la version servie : commit et tag injectés au build"
epic: INFRA
type: chore
priority: P1
size: S
milestone: M0 Outillage agents et staging
blocked_by: []
adr: [0023]
risques: []
revue_visuelle: false
---

## Contexte

La mise en prod passe désormais par l'outil partagé `release` (onglet Versions
de la console) : il pose le tag `vX.Y.Z`, avance `main`, suit le workflow
`livraison.yml`, puis interroge `/api/health` de la prod. Or `livraison.yml`
ne fait que publier les images : c'est l'agent du VPS qui les applique ensuite
(ADR 0023). Un workflow vert ne prouve donc pas que la prod tourne la nouvelle
version. Si `/api/health` renvoie le commit et le tag servis, `release` les
compare à ce qu'il vient de promouvoir (champs `revision` et `version`).

## État actuel du code

- `packages/contracts/src/lib/health.ts` : `HealthResponse` = `{ status: 'ok'; database: HealthProbeSnapshot }`.
- `packages/api/src/app/health/health.service.ts` : `read()` lit la dernière sonde et renvoie `status` et `database` ; 503 sans sonde.
- `packages/api/src/app/health/health.controller.ts` : `GET /api/health`, `@Public()`.
- `packages/api/src/app/health/health.integration-spec.ts` et `health.service.spec.ts` : vérifient la réponse exacte.
- `packages/api/Dockerfile` : deux étapes (`build`, `runtime`), aucun `ARG`.
- `.github/workflows/livraison.yml`, job `publier` : `docker build` avec les labels `org.opencontainers.image.revision=${GITHUB_SHA}`, `.source` et `.created`, sans `--build-arg`. Le checkout ne récupère pas les tags.

## À faire

- `HealthResponse` gagne `revision: string | null` (commit complet) et `version: string | null` (tag `vX.Y.Z` du commit, `null` hors version).
- `HealthService.read()` les lit dans `APP_REVISION` et `APP_VERSION` (absentes ou vides : `null`), sans toucher à la sonde.
- `packages/api/Dockerfile`, étape `runtime` : `ARG APP_REVISION` et `ARG APP_VERSION`, recopiés en `ENV`.
- `livraison.yml`, job `publier` : récupérer les tags du commit (`git fetch --depth=1 origin 'refs/tags/v*:refs/tags/v*'`), prendre `git tag --points-at HEAD --list 'v*'` (le plus haut s'il y en a plusieurs, vide sinon), et passer `--build-arg APP_REVISION=${GITHUB_SHA} --build-arg APP_VERSION=<tag>` à **l'image `api` seulement**.
- Mettre à jour les deux tests de la santé.

## Décisions déjà prises

- Noms des champs : `revision` et `version`, ceux que lit `release`.
- La route reste publique : le commit et le tag ne sont pas des secrets, et `release` l'interroge sans session.
- `release` pousse le tag et `main` en un seul push atomique : le tag existe quand `livraison.yml` démarre.
- Pas de valeur par défaut inventée (`dev`, `unknown`) : `null`, que `release` sait traiter.

## Critères d'acceptation

- [ ] Avec `APP_REVISION` et `APP_VERSION` définies, `GET /api/health` les renvoie dans `revision` et `version`.
- [ ] Sans elles, les deux champs valent `null` et le reste de la réponse est inchangé.
- [ ] Sans sonde, la route répond toujours 503.
- [ ] Une image `api` construite par `livraison.yml` sur un commit tagué `v0.1.0` porte `APP_REVISION` = le commit et `APP_VERSION` = `v0.1.0` (`docker inspect`, ou la sortie du job).

## Vérification

- `pnpm exec nx test api -- health.service`, puis `pnpm exec nx test-integration api -- health`.
- `pnpm exec nx affected -t lint test build --base=origin/develop`.
- `docker build -f packages/api/Dockerfile --build-arg APP_REVISION=abc --build-arg APP_VERSION=v0.0.0 .` puis `docker inspect` de l'image.

## Pour la prod

Rien : la prochaine livraison porte les champs.

## Hors périmètre

- La comparaison côté `release` : elle existe déjà dans l'outil partagé.
- Le staging et le déploiement poussé : INFRA-7, INFRA-8.

## Dépendances

Aucune.
