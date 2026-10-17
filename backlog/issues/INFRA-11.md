---
id: INFRA-11
title: "Provisionnement idempotent de la machine, indépendant de l'hébergeur, testé en CI"
epic: INFRA
type: chore
priority: P1
size: M
milestone: M7 Infra de fond
blocked_by: []
adr: [0025, 0032]
risques: [OPS-4]
revue_visuelle: false
---

## Contexte

La cible reste le VPS OVH, puis le homelab. Changer de machine doit revenir à relancer un script, redéployer et basculer le DNS, sans rien refaire à la main (`docs/migration-homelab.md` recense les pièges).

## État actuel du code

- `infra/deploy/bin/install.sh`, `infra/backup/`, `infra/edge/` : installation des briques, pas de la machine.
- Modèle : `~/projects/TGR/TGR MON REPO/infra/provision.sh` et `provision.test.mjs` (durcissement SSH, pare-feu, règles `DOCKER-USER`, mises à jour automatiques, Docker).

## À faire

- `infra/provision/provision.sh`, idempotent, Debian 12+ ou Ubuntu 22.04+, x86 ou ARM : SSH par clé uniquement, root désactivé, fail2ban ; pare-feu (22, 80, 443) avec règles `DOCKER-USER` pour qu'un port publié par Docker ne contourne pas le pare-feu ; mises à jour de sécurité automatiques ; Docker et Compose ; utilisateur d'administration.
- Tests : `infra/provision/` dans Nx (`test`) sur le modèle de `provision.test.mjs` de TGR, et un job CI qui exécute le script deux fois de suite sur une machine jetable (conteneur systemd ou runner Ubuntu).
- Mettre `docs/migration-homelab.md` à jour : la section machine renvoie au script.

## Décisions déjà prises

- Aucun port public au-delà de 22, 80 et 443.

## Critères d'acceptation

- [ ] Deux exécutions de suite ne changent rien à la seconde.
- [ ] Un port publié par Docker hors 80/443 reste fermé de l'extérieur.

## Vérification

- `pnpm exec nx test provision` ; job CI dédié.

## Pour la prod

Ajouter à `docs/pilotage/mep.json` : exécuter le script sur le VPS actuel et vérifier qu'il ne change rien d'essentiel (ou noter les écarts).

## Hors périmètre

Aucun.

## Dépendances

Aucune.
