---
id: INFRA-9
title: "Mettre en service le staging et le CD poussé (DNS, client OIDC, clés, environnements GitHub)"
epic: INFRA
type: externe
priority: P0
size: S
milestone: M0 Outillage agents et staging
blocked_by: [INFRA-8]
adr: [0031, 0032]
risques: [SEC-3, SEC-4]
revue_visuelle: false
---

## Contexte

Les gestes qui demandent un accès que les agents n'ont pas : Authentik, VPS, paramètres du dépôt GitHub. Ils suivent les éléments ajoutés à `docs/pilotage/mep.json` par INFRA-7 et INFRA-8.

## État actuel du code

- `docs/pilotage/mep.json` (éléments de INFRA-7 et INFRA-8), `infra/deploy/README.md` sections « Staging » et « Déploiement ».

## À faire

- Vérifier la résolution DNS de `staging.<domaine>` et `staging-portfolio.<domaine>`.
- Authentik : créer le client OIDC de staging, URI de redirection du staging.
- VPS : poser `staging.env`, créer le réseau `personal-os-staging-edge`, poser les deux clés publiques, relancer `install.sh`.
- GitHub : environnements `staging` et `production` (protection sur `main`), secrets et variables.
- Premier déploiement du staging par un merge sur `develop`, puis vérification de la connexion avec les deux comptes.
- Cocher les éléments correspondants dans la page MEP du pilotage.

## Décisions déjà prises

Aucune à prendre : tout est fixé par INFRA-7 et INFRA-8.

## Critères d'acceptation

- [ ] Le staging s'ouvre sur `https://staging.<domaine>` après connexion Authentik et montre le jeu de démo.
- [ ] Le job `staging` d'un merge sur `develop` est vert.

## Vérification

- Ouvrir le staging avec chacun des deux comptes.

## Pour la prod

Ce ticket **est** la mise en service.

## Hors périmètre

- Le code : INFRA-7, INFRA-8.

## Dépendances

- INFRA-8.
