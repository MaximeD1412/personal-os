#!/usr/bin/env bash
# Vérifie qu'une sauvegarde récente existe dans le dépôt Restic.
#
#   watch.sh
#
# Lancé toutes les 6 heures par personal-os-backup-watch.timer, indépendamment
# de la sauvegarde. Échoue si le dernier instantané a plus de 26 heures, ou si
# le dépôt ne répond pas : l'unité tombe alors en échec, et OnFailure= envoie
# l'alerte par notify-failure.sh. C'est le seul moyen d'apprendre qu'une
# sauvegarde ne se lance plus du tout — un échec, lui, se signale tout seul.
set -euo pipefail

LOG_TAG=surveillance
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/common.sh
. "$SCRIPT_DIR/../lib/common.sh"

# Une sauvegarde quotidienne, plus une marge pour le délai aléatoire du timer
# et une reprise lente.
AGE_MAXIMAL_HEURES=26

case "${1:-}" in
  "") ;;
  -h | --help)
    sed -n '2,10p' "${BASH_SOURCE[0]}"
    exit 0
    ;;
  *) die "argument inconnu : $1" ;;
esac

load_config
assert_password_file

# --no-lock : une simple lecture. Sans lui, une vérification qui croise la
# rétention (`forget --prune` verrouille le dépôt en exclusif) donnerait une
# fausse alerte.
JSON=$(restic snapshots --no-lock --tag personal-os --latest 1 --json) ||
  die "dépôt $RESTIC_REPOSITORY injoignable — impossible de vérifier la dernière sauvegarde"

# --latest 1 rend le dernier instantané de chaque couple hôte/chemins : le plus
# récent de tous est celui qui compte.
dernier=0
while read -r horodatage; do
  [ -n "$horodatage" ] || continue
  secondes=$(date -d "$horodatage" +%s) ||
    die "horodatage illisible dans la réponse de restic : $horodatage"
  if [ "$secondes" -gt "$dernier" ]; then
    dernier=$secondes
  fi
done < <(printf '%s' "$JSON" | grep -o '"time":"[^"]*"' | cut -d'"' -f4)

[ "$dernier" -gt 0 ] ||
  die "aucun instantané dans $RESTIC_REPOSITORY — aucune sauvegarde n'a jamais réussi"

age=$(($(date +%s) - dernier))
quand=$(date -u -d "@$dernier" +%Y-%m-%dT%H:%M:%SZ)

[ "$age" -le $((AGE_MAXIMAL_HEURES * 3600)) ] ||
  die "dernière sauvegarde le $quand, il y a plus de ${AGE_MAXIMAL_HEURES} heures ($((age / 3600)) h)"

log "dernière sauvegarde le $quand, il y a $((age / 3600)) h"
