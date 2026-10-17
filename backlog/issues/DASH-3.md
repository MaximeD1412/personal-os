---
id: DASH-3
title: "Widget de l'état des sauvegardes"
epic: DASH
type: feature
priority: P2
size: S
milestone: M5 Tableau de bord et barre de commande
blocked_by: [DASH-2, INFRA-13]
adr: [0020]
risques: [OPS-1]
revue_visuelle: true
---

## Contexte

Le PRD veut un widget d'état de santé, dont l'état des sauvegardes. L'API ne voit pas Restic : l'agent de sauvegarde doit lui transmettre son dernier résultat.

## État actuel du code

- `infra/backup/` (agent Restic), vérification d'absence (INFRA-13) ; registre des résumeurs (DASH-1).

## À faire

- Prisma : `BackupStatus { id (singleton), lastSuccessAt, lastRunAt, lastError String? }` hors Espace.
- L'agent de sauvegarde, à la fin de chaque exécution, écrit son résultat par `POST /internal/backup-status` (jeton partagé `BACKUP_STATUS_TOKEN`, route `@Public()` protégée par ce jeton, non routée par le proxy public : écoute sur le réseau interne uniquement).
- Résumeur `backup` : indicateur « Dernière sauvegarde », signal si plus de 26 heures.
- Widget sur l'accueil.

## Décisions déjà prises

- Seuil : 26 heures, comme INFRA-13.

## Critères d'acceptation

- [ ] Le widget montre la date de la dernière sauvegarde réussie.
- [ ] La route interne refuse sans jeton et n'est pas joignable depuis Internet.

## Vérification

- `pnpm exec nx test-integration api -- backup-status` ; `pnpm exec nx test backup` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /`.

## Pour la prod

Ajouter à `docs/pilotage/mep.json` : générer `BACKUP_STATUS_TOKEN`, le poser dans `stack.env` et dans la configuration de l'agent de sauvegarde.

## Hors périmètre

Aucun.

## Dépendances

- DASH-2, INFRA-13.
