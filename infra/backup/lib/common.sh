#!/usr/bin/env bash
# Fonctions partagées par backup.sh et restore.sh.
: "${BACKUP_CONF:=/etc/personal-os/backup.conf}"
: "${RESTIC_ENV_FILE:=/etc/personal-os/restic.env}"

log() {
  printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${LOG_TAG:-backup}" "$*" >&2
}

die() {
  log "ERREUR: $*"
  exit 1
}

load_config() {
  [ -r "$BACKUP_CONF" ] || die "configuration illisible : $BACKUP_CONF"
  # shellcheck disable=SC1090
  . "$BACKUP_CONF"

  if [ -r "$RESTIC_ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$RESTIC_ENV_FILE"
    set +a
  elif [ -z "${RESTIC_REPOSITORY:-}" ]; then
    die "ni $RESTIC_ENV_FILE ni RESTIC_REPOSITORY dans l'environnement"
  fi

  : "${POSTGRES_CONTAINER:=personal-os-db}"
  : "${POSTGRES_USER:=personalos}"
  : "${POSTGRES_DB:=personalos}"
  : "${POSTGRES_DATABASES:=$POSTGRES_DB}"
  : "${KEEP_DAILY:=7}"
  : "${KEEP_WEEKLY:=4}"
  : "${KEEP_MONTHLY:=6}"
}

load_database_list() {
  # shellcheck disable=SC2206
  POSTGRES_DATABASE_LIST=(${POSTGRES_DATABASES})

  [ ${#POSTGRES_DATABASE_LIST[@]} -gt 0 ] ||
    die "POSTGRES_DATABASES est vide — aucune base à sauvegarder"

  local base
  for base in "${POSTGRES_DATABASE_LIST[@]}"; do
    case "$base" in
      *[!A-Za-z0-9_-]*)
        die "nom de base refusé : « $base » n'est pas un nom de base PostgreSQL"
        ;;
    esac
  done
}

conteneur_initialise() {
  local journal
  journal=$(docker logs "$1" 2>&1) || return 1

  case "$journal" in
    *'PostgreSQL init process complete'*) return 0 ;;
  esac
  return 1
}

assert_password_file() {
  [ -n "${RESTIC_PASSWORD_FILE:-}" ] ||
    die "RESTIC_PASSWORD_FILE absent — le mot de passe doit vivre dans un fichier, pas dans l'environnement"
  [ -z "${RESTIC_PASSWORD:-}" ] ||
    die "RESTIC_PASSWORD présent dans l'environnement — utiliser RESTIC_PASSWORD_FILE"

  if [ "${SKIP_PASSWORD_FILE_CHECKS:-0}" != 1 ]; then
    [ -r "$RESTIC_PASSWORD_FILE" ] || die "clé illisible : $RESTIC_PASSWORD_FILE"

    local mode
    mode=$(stat -c '%a' "$RESTIC_PASSWORD_FILE")
    case "$mode" in
      600 | 400) ;;
      *) die "clé $RESTIC_PASSWORD_FILE en mode $mode — attendu 600" ;;
    esac
  fi
}

retention_args() {
  printf '%s\n' \
    --keep-daily "${KEEP_DAILY}" \
    --keep-weekly "${KEEP_WEEKLY}" \
    --keep-monthly "${KEEP_MONTHLY}"
}

heartbeat() {
  local status="$1" # "start", "success" ou "fail"
  [ -n "${BACKUP_HEARTBEAT_URL:-}" ] || return 0

  local url="$BACKUP_HEARTBEAT_URL"
  case "$status" in
    start) url="$url/start" ;;
    fail) url="$url/fail" ;;
    success) ;;
    *) die "état de témoin inconnu : $status" ;;
  esac

  if ! curl --silent --show-error --max-time 10 --retry 3 --fail -o /dev/null "$url"; then
    log "témoin d'inactivité injoignable ($status) — sauvegarde non affectée"
  fi
}
