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
CONTENEUR_DE_COPIE=""
cleanup() {
  local code=$?
  [ -n "$CONTENEUR_DE_COPIE" ] && docker rm --force "$CONTENEUR_DE_COPIE" >/dev/null 2>&1
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

# Le bucket du stockage objet n'est pas un chemin de la machine : il est
# recopié dans le transit, et part dans le même instantané que les dumps.
# Les clés passent à rclone par son environnement, jamais par sa ligne de
# commande, que `ps` montre à tout le monde.
if [ -n "${S3_MIRROR_BUCKET:-}" ]; then
  for variable in S3_MIRROR_ENDPOINT S3_MIRROR_REGION S3_MIRROR_ACCESS_KEY_ID S3_MIRROR_SECRET_ACCESS_KEY; do
    [ -n "${!variable:-}" ] ||
      die "$variable absent — requis pour recopier le bucket $S3_MIRROR_BUCKET"
  done
fi
: "${S3_MIRROR_IMAGE:=rclone/rclone:1.75.2}"

# Pas de montage : le démon Docker résoudrait son chemin dans le /tmp de la
# machine, pas dans le /tmp privé du service (PrivateTmp=yes), et Restic
# sauvegarderait un dossier vide. rclone copie dans son conteneur, puis
# `docker cp` en extrait le contenu : c'est le client, dans le service, qui
# écrit le transit.
copier_le_bucket() {
  CONTENEUR_DE_COPIE="personal-os-sauvegarde-objets-$$"
  RCLONE_CONFIG_OBJETS_TYPE=s3 \
    RCLONE_CONFIG_OBJETS_PROVIDER=Other \
    RCLONE_CONFIG_OBJETS_ENDPOINT="$S3_MIRROR_ENDPOINT" \
    RCLONE_CONFIG_OBJETS_REGION="$S3_MIRROR_REGION" \
    RCLONE_CONFIG_OBJETS_ACCESS_KEY_ID="$S3_MIRROR_ACCESS_KEY_ID" \
    RCLONE_CONFIG_OBJETS_SECRET_ACCESS_KEY="$S3_MIRROR_SECRET_ACCESS_KEY" \
    docker create --name "$CONTENEUR_DE_COPIE" \
    -e RCLONE_CONFIG_OBJETS_TYPE -e RCLONE_CONFIG_OBJETS_PROVIDER \
    -e RCLONE_CONFIG_OBJETS_ENDPOINT -e RCLONE_CONFIG_OBJETS_REGION \
    -e RCLONE_CONFIG_OBJETS_ACCESS_KEY_ID -e RCLONE_CONFIG_OBJETS_SECRET_ACCESS_KEY \
    "$S3_MIRROR_IMAGE" copy "objets:$S3_MIRROR_BUCKET" /data >/dev/null &&
    docker start --attach "$CONTENEUR_DE_COPIE" &&
    docker cp --quiet "$CONTENEUR_DE_COPIE:/data/." "$1"
  local code=$?
  docker rm --force "$CONTENEUR_DE_COPIE" >/dev/null 2>&1
  CONTENEUR_DE_COPIE=""
  return $code
}

RESTIC_BACKUP_ARGS=(backup --tag personal-os --tag "hôte=$(hostname)")

if [ "$DRY_RUN" = 1 ]; then
  plan "dépôt ${RESTIC_REPOSITORY}"
  plan "clé lue dans ${RESTIC_PASSWORD_FILE}"
  for base in "${POSTGRES_DATABASE_LIST[@]}"; do
    mapfile -t commande < <(pg_dump_cmd "$base")
    plan "dump ${commande[*]} -> <transit>/$(dump_relative "$base")"
  done
  if [ -n "${S3_MIRROR_BUCKET:-}" ]; then
    plan "copie du bucket ${S3_MIRROR_BUCKET} (${S3_MIRROR_ENDPOINT}) -> <transit>/objets"
  fi
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

if [ -n "${S3_MIRROR_BUCKET:-}" ]; then
  log "copie du bucket $S3_MIRROR_BUCKET"
  mkdir -p "$STAGING/objets"
  copier_le_bucket "$STAGING/objets" ||
    die "copie du bucket $S3_MIRROR_BUCKET échouée — sauvegarde interrompue"
fi

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
