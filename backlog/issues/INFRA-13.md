---
id: INFRA-13
title: "Alerte quand une sauvegarde attendue manque"
epic: INFRA
type: chore
priority: P1
size: S
milestone: M0 Outillage agents et staging
blocked_by: []
adr: [0020]
risques: [OPS-1]
revue_visuelle: false
---

## Contexte

Une sauvegarde qui échoue en silence est une perte de données différée. L'agent de sauvegarde signale ses échecs, mais une sauvegarde qui **ne se lance pas du tout** (minuteur désactivé, machine redémarrée sans l'unité) ne déclenche rien.

## État actuel du code

- `infra/backup/` : `bin/`, `lib/`, `systemd/`, `README.md` ; Restic chez un autre fournisseur qu'OVH.
- Le déploiement utilise un « témoin d'inactivité » dans `infra/deploy/bin/notify-failure.sh` : modèle de signalement à réutiliser.

## À faire

- Une vérification indépendante (unité systemd et minuteur `personal-os-backup-watch`, toutes les 6 heures) qui lit l'horodatage du dernier instantané Restic réussi (`restic snapshots --latest 1 --json`) et alerte par le même canal que `notify-failure.sh` s'il date de plus de 26 heures.
- `infra/backup/bin/install.sh` (ou le script d'installation existant) pose ces unités.
- README : ce que surveille la vérification, et comment tester l'alerte.

## Décisions déjà prises

- Seuil : 26 heures (une sauvegarde quotidienne plus une marge).

## Critères d'acceptation

- [ ] Sans instantané récent, l'alerte part.
- [ ] Avec un instantané de moins de 26 heures, rien ne part.

## Vérification

- `pnpm exec nx test backup` et `pnpm exec nx test-integration backup`, en suivant les tests existants de `infra/backup/src/`.

## Pour la prod

Ajouter à `docs/pilotage/mep.json` : relancer l'installation de l'agent de sauvegarde sur le VPS, puis déclencher l'alerte une fois à la main pour vérifier sa réception.

## Hors périmètre

- Le widget du tableau de bord : DASH-3.

## Dépendances

Aucune.
