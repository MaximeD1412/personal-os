#!/usr/bin/env bash
# Fonctions partagées par les scripts de déploiement.
: "${DEPLOY_CONF:=/etc/personal-os/deploy.conf}"
: "${GHCR_ENV_FILE:=/etc/personal-os/ghcr.env}"

log() {
  printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${LOG_TAG:-deploy}" "$*" >&2
}

die() {
  log "ERREUR: $*"
  exit 1
}

plan() { printf 'plan: %s\n' "$*"; }

load_config() {
  [ -r "$DEPLOY_CONF" ] || die "configuration illisible : $DEPLOY_CONF"
  # shellcheck disable=SC1090
  . "$DEPLOY_CONF"

  if [ -r "$GHCR_ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$GHCR_ENV_FILE"
    set +a
  fi

  : "${REGISTRY:?REGISTRY absent de $DEPLOY_CONF}"
  : "${IMAGES:=api dashboard portfolio}"
  : "${CHANNEL_TAG:=main}"
  : "${CHANNEL_IMAGE:=api}"

  : "${COMPOSE_FILE:=/opt/personal-os/docker-compose.yml}"
  : "${COMPOSE_ENV_FILE:=/opt/personal-os/.env}"
  : "${COMPOSE_PROJECT:=personal-os}"
  : "${CADDY_DIR:=/opt/personal-os/caddy}"

  : "${SOURCE_CHECKOUT:=/opt/personal-os/src}"
  : "${DEPLOY_PREFIX:=/opt/personal-os/deploy}"

  : "${MIGRATE_SERVICE:=api}"
  : "${MIGRATE_COMMAND:=node_modules/.bin/prisma migrate deploy}"
  : "${RESTORE_SCRIPT:=/opt/personal-os/backup/bin/restore.sh}"
  : "${REHEARSAL_TARGET:=/var/tmp/personal-os-repetition}"
  : "${REHEARSAL_PROBE_PORT:=55432}"

  : "${HEALTH_URL:=http://127.0.0.1:3001/api/health}"
  : "${HEALTH_RETRIES:=30}"
  : "${HEALTH_DELAY:=2}"

  : "${DEPLOY_STATE_FILE:=/var/lib/personal-os/deploy-state}"
  : "${DEPLOY_HISTORY_FILE:=/var/log/personal-os/deploy.log}"
}

assert_revision() {
  local revision="$1"
  [ -n "$revision" ] || die "révision vide"
  case "$revision" in
    *[!0-9a-f]*) die "révision mouvante ou malformée : $revision — un commit est attendu" ;;
  esac
  [ "${#revision}" -ge 7 ] || die "révision trop courte : $revision"
}

channel_revision() {
  local reference="${REGISTRY}/${CHANNEL_IMAGE}:${CHANNEL_TAG}"
  local revision
  revision=$(docker buildx imagetools inspect "$reference" \
    --format '{{ index .Image.Config.Labels "org.opencontainers.image.revision" }}' 2>/dev/null) ||
    die "canal $reference injoignable — registre indisponible ou identifiants expirés"

  revision=$(printf '%s' "$revision" | tr -d '[:space:]')
  [ -n "$revision" ] || die "aucun libellé org.opencontainers.image.revision sur $reference"
  printf '%s' "$revision"
}

deployed_revision() {
  [ -r "$DEPLOY_STATE_FILE" ] || return 0
  # shellcheck disable=SC1090
  ( . "$DEPLOY_STATE_FILE"; printf '%s' "${DEPLOYED_REVISION:-}" )
}

previous_revision() {
  [ -r "$DEPLOY_STATE_FILE" ] || return 0
  # shellcheck disable=SC1090
  ( . "$DEPLOY_STATE_FILE"; printf '%s' "${PREVIOUS_REVISION:-}" )
}

failed_revision() {
  [ -r "$DEPLOY_STATE_FILE" ] || return 0
  # shellcheck disable=SC1090
  ( . "$DEPLOY_STATE_FILE"; printf '%s' "${FAILED_REVISION:-}" )
}

write_state() {
  local deployed="$1" previous="$2" failed="${3:-}"
  local dir
  dir=$(dirname "$DEPLOY_STATE_FILE")
  mkdir -p "$dir"
  cat >"${DEPLOY_STATE_FILE}.tmp" <<EOF
DEPLOYED_REVISION=$deployed
PREVIOUS_REVISION=$previous
FAILED_REVISION=$failed
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
  mv "${DEPLOY_STATE_FILE}.tmp" "$DEPLOY_STATE_FILE"
}

history_append() {
  local event="$1" revision="$2" detail="${3:-}"
  local dir
  dir=$(dirname "$DEPLOY_HISTORY_FILE")
  mkdir -p "$dir"
  printf '%s\t%s\t%s\t%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$event" "$revision" "$detail" \
    >>"$DEPLOY_HISTORY_FILE"
}

sync_stack() {
  local revision="$1"

  [ -d "$SOURCE_CHECKOUT/.git" ] ||
    die "clone du dépôt absent : $SOURCE_CHECKOUT — voir install.sh"

  git -C "$SOURCE_CHECKOUT" fetch --quiet origin \
    "+refs/heads/${CHANNEL_TAG}:refs/remotes/origin/${CHANNEL_TAG}" ||
    die "impossible de récupérer $CHANNEL_TAG depuis l'origine"
  git -C "$SOURCE_CHECKOUT" checkout --quiet --detach "$revision" ||
    die "révision $revision absente du dépôt"

  local source="$SOURCE_CHECKOUT/infra/deploy"
  install -m 644 "$source/docker-compose.prod.yml" "$COMPOSE_FILE"
  install -d -m 755 "$CADDY_DIR" "$CADDY_DIR/conf.d"
  install -m 644 "$source/caddy/Caddyfile" "$CADDY_DIR/Caddyfile"
  for block in "$source"/caddy/conf.d/*; do
    [ -e "$block" ] || continue
    install -m 644 "$block" "$CADDY_DIR/conf.d/$(basename "$block")"
  done

  if ! diff --recursive --brief "$source/bin" "$DEPLOY_PREFIX/bin" >/dev/null 2>&1 ||
    ! diff --recursive --brief "$source/lib" "$DEPLOY_PREFIX/lib" >/dev/null 2>&1; then
    log "ATTENTION: l'agent installé diffère de la révision $revision — relancer $source/bin/install.sh"
  fi
}

compose_at() {
  local revision="$1"
  shift
  IMAGE_TAG="$revision" REGISTRY="$REGISTRY" \
    docker compose \
    --file "$COMPOSE_FILE" \
    --env-file "$COMPOSE_ENV_FILE" \
    --project-name "$COMPOSE_PROJECT" \
    "$@"
}

health_ok() {
  local attempt=0
  while [ "$attempt" -lt "$HEALTH_RETRIES" ]; do
    if curl --silent --show-error --fail --max-time 5 -o /dev/null "$HEALTH_URL"; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep "$HEALTH_DELAY"
  done
  return 1
}

heartbeat() {
  local status="$1" # "start", "success" ou "fail"
  [ -n "${DEPLOY_HEARTBEAT_URL:-}" ] || return 0

  local url="$DEPLOY_HEARTBEAT_URL"
  case "$status" in
    start) url="$url/start" ;;
    fail) url="$url/fail" ;;
    success) ;;
    *) die "état de témoin inconnu : $status" ;;
  esac

  if ! curl --silent --show-error --max-time 10 --retry 3 --fail -o /dev/null "$url"; then
    log "témoin d'inactivité injoignable ($status) — déploiement non affecté"
  fi
}
