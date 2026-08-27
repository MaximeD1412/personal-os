#!/usr/bin/env bash
# Sauvegarde Personal OS vers le dépôt Restic distant.
#
#   backup.sh [--dry-run]
#
# --dry-run imprime le plan sans exécuter la sauvegarde.
set -euo pipefail

LOG_TAG=sauvegarde
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/common.sh
. "$SCRIPT_DIR/../lib/common.sh"

DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      sed -n '2,6p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) die "argument inconnu : $1" ;;
  esac
  shift
done

plan() { printf 'plan: %s\n' "$*"; }

load_config
assert_password_file

STAGING=""
cleanup() {
  local code=$?
  [ -n "$STAGING" ] && rm -rf -- "$STAGING"
  return $code
}
trap cleanup EXIT

load_database_list

pg_dump_cmd() {
  printf '%s\n' docker exec -i "$POSTGRES_CONTAINER" \
    pg_dump -U "$POSTGRES_USER" -d "$1" --format=custom -Z0
}

dump_relative() {
  printf 'postgres/%s.dump\n' "$1"
}

RESTIC_BACKUP_ARGS=(backup --tag personal-os --tag "hôte=$(hostname)")

if [ "$DRY_RUN" = 1 ]; then
  plan "dépôt ${RESTIC_REPOSITORY}"
  plan "clé lue dans ${RESTIC_PASSWORD_FILE}"
  for base in "${POSTGRES_DATABASE_LIST[@]}"; do
    mapfile -t commande < <(pg_dump_cmd "$base")
    plan "dump ${commande[*]} -> <transit>/$(dump_relative "$base")"
  done
  for path in ${BACKUP_PATHS:-}; do
    plan "inclut ${path}"
  done
  plan "restic ${RESTIC_BACKUP_ARGS[*]} <transit> ${BACKUP_PATHS:-}"
  plan "restic forget $(retention_args | tr '\n' ' ')--prune"
  plan "restic check"
  plan "témoin ${BACKUP_HEARTBEAT_URL:-<aucun>}"
  exit 0
fi

heartbeat start
trap 'heartbeat fail; cleanup' EXIT

STAGING=$(mktemp -d)
chmod 700 "$STAGING"

for base in "${POSTGRES_DATABASE_LIST[@]}"; do
  relative=$(dump_relative "$base")
  mkdir -p "$STAGING/$(dirname "$relative")"

  log "dump de $base depuis $POSTGRES_CONTAINER"
  mapfile -t commande < <(pg_dump_cmd "$base")
  "${commande[@]}" >"$STAGING/$relative"

  log "vérification de la lisibilité du dump de $base"
  docker exec -i "$POSTGRES_CONTAINER" pg_restore --list >/dev/null <"$STAGING/$relative" ||
    die "dump de $base illisible par pg_restore — sauvegarde interrompue"
done

log "envoi vers $RESTIC_REPOSITORY"
# shellcheck disable=SC2086 # BACKUP_PATHS est une liste de chemins, à découper
restic "${RESTIC_BACKUP_ARGS[@]}" "$STAGING" ${BACKUP_PATHS:-}

log "application de la rétention"
mapfile -t keep_args < <(retention_args)
restic forget "${keep_args[@]}" --prune

log "vérification du dépôt"
restic check

trap cleanup EXIT
heartbeat success
log "sauvegarde terminée"
