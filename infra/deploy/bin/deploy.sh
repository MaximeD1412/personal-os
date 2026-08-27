#!/usr/bin/env bash
# Applique sur cette machine la version publiée sur le canal.
#
#   deploy.sh [--revision SHA] [--force] [--rollback] [--dry-run]
#
#   --revision   déploie ce commit précis plutôt que celui du canal
#   --force      redéploie même si la révision est déjà en place, ou si elle a
#                déjà échoué
#   --rollback   revient à la révision précédente, sans rien migrer
#   --dry-run    imprime le plan, n'exécute rien
#
set -euo pipefail

LOG_TAG=deploiement
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/common.sh
. "$SCRIPT_DIR/../lib/common.sh"

REVISION=""
FORCE=0
ROLLBACK=0
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --revision)
      REVISION="${2:-}"
      shift
      ;;
    --force) FORCE=1 ;;
    --rollback) ROLLBACK=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      sed -n '2,11p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) die "argument inconnu : $1" ;;
  esac
  shift
done

load_config

assert_ready() {
  [ -r "$COMPOSE_FILE" ] || die "pile de production illisible : $COMPOSE_FILE"
  [ -r "$COMPOSE_ENV_FILE" ] ||
    die "environnement de production illisible : $COMPOSE_ENV_FILE"

  [ -x "$RESTORE_SCRIPT" ] ||
    die "banc d'essai de migration absent : $RESTORE_SCRIPT — la sauvegarde n'est pas installée"
}

assert_tools() {
  for tool in docker curl git; do
    command -v "$tool" >/dev/null 2>&1 || die "$tool est absent de la machine"
  done
  docker buildx version >/dev/null 2>&1 ||
    die "docker buildx est absent — l'agent en a besoin pour lire la révision du canal"
}

assert_ready

DEPLOYED=$(deployed_revision)
PREVIOUS=$(previous_revision)
FAILED=$(failed_revision)

# --------------------------------------------------------------------------
# Retour arrière
# --------------------------------------------------------------------------

if [ "$ROLLBACK" = 1 ]; then
  TARGET="${REVISION:-$PREVIOUS}"
  [ -n "$TARGET" ] ||
    die "aucune révision précédente enregistrée — rien vers quoi revenir"
  assert_revision "$TARGET"

  if [ "$DRY_RUN" = 1 ]; then
    plan "pile et routage repris de ${SOURCE_CHECKOUT} en ${TARGET}"
    plan "retour aux images ${REGISTRY}/*:${TARGET}"
    plan "docker compose up --detach --force-recreate"
    plan "santé ${HEALTH_URL} (${HEALTH_RETRIES} essais, ${HEALTH_DELAY} s)"
    plan "aucune migration — un retour arrière ne touche jamais la base"
    exit 0
  fi

  assert_tools
  log "retour aux images $TARGET"
  sync_stack "$TARGET"
  compose_at "$TARGET" up --detach --force-recreate
  if health_ok; then
    write_state "$TARGET" "$PREVIOUS" "$FAILED"
    history_append retour-arriere "$TARGET" "santé rétablie"
    log "retour arrière terminé sur $TARGET"
    exit 0
  fi
  history_append retour-arriere-echoue "$TARGET" "santé toujours en échec"
  die "santé toujours en échec après retour sur $TARGET — intervention nécessaire"
fi

# --------------------------------------------------------------------------
# Déploiement
# --------------------------------------------------------------------------

if [ -z "$REVISION" ]; then
  if [ "$DRY_RUN" = 1 ]; then
    REVISION="<révision du canal>"
  else
    assert_tools
    REVISION=$(channel_revision)
  fi
fi

if [ "$DRY_RUN" != 1 ] || [ "$REVISION" != "<révision du canal>" ]; then
  assert_revision "$REVISION"
fi

if [ "$DRY_RUN" = 1 ]; then
  plan "canal ${REGISTRY}/${CHANNEL_IMAGE}:${CHANNEL_TAG} -> ${REVISION}"
  plan "révision en place : ${DEPLOYED:-aucune}"
  plan "répétition ${RESTORE_SCRIPT} --target ${REHEARSAL_TARGET} --into-postgres --keep"
  plan "répétition migration ${MIGRATE_COMMAND} sur la restauration"
  plan "pile et routage repris de ${SOURCE_CHECKOUT} en ${REVISION}"
  plan "docker compose pull (${IMAGES}) en ${REVISION}"
  plan "migration réelle ${MIGRATE_COMMAND} sur le service ${MIGRATE_SERVICE}"
  plan "docker compose up --detach"
  plan "santé ${HEALTH_URL} (${HEALTH_RETRIES} essais, ${HEALTH_DELAY} s)"
  plan "si la santé échoue, retour aux images ${DEPLOYED:-aucune} sans toucher la base"
  exit 0
fi

if [ "$REVISION" = "$DEPLOYED" ] && [ "$FORCE" != 1 ]; then
  log "révision $REVISION déjà en place — rien à faire"
  exit 0
fi

if [ "$REVISION" = "$FAILED" ] && [ "$FORCE" != 1 ]; then
  log "révision $REVISION déjà en échec — ignorée, relancer avec --force pour réessayer"
  exit 0
fi

assert_tools

remove_rehearsal_containers() {
  local ids
  ids=$(docker ps --all --quiet --filter 'name=personal-os-restore-' 2>/dev/null || true)
  [ -n "$ids" ] || return 0
  # shellcheck disable=SC2086 # liste d'identifiants, à découper
  docker rm --force $ids >/dev/null 2>&1 || true
}

cleanup_rehearsal() {
  remove_rehearsal_containers
  rm -rf -- "$REHEARSAL_TARGET"
  REHEARSAL_ACTIVE=0
}

REHEARSAL_ACTIVE=0

FAILURE_RECORDED=0

on_exit() {
  local code=$?
  [ "$REHEARSAL_ACTIVE" = 1 ] && cleanup_rehearsal
  if [ "$code" -ne 0 ]; then
    if [ "$FAILURE_RECORDED" != 1 ]; then
      history_append echec-inattendu "$REVISION" "sortie $code"
      write_state "${DEPLOYED:-}" "$PREVIOUS" "$REVISION"
    fi
    heartbeat fail
  fi
  return $code
}

heartbeat start
trap on_exit EXIT

log "déploiement de $REVISION (en place : ${DEPLOYED:-aucune})"
history_append debut "$REVISION" "depuis ${DEPLOYED:-aucune}"

# --- 1. Répétition de la migration sur une restauration -------------------

log "répétition de la migration sur une restauration de la dernière sauvegarde"
remove_rehearsal_containers
rm -rf -- "$REHEARSAL_TARGET"
REHEARSAL_ACTIVE=1

REHEARSAL_OUTPUT=$(RESTORE_PROBE_PORT="$REHEARSAL_PROBE_PORT" \
  "$RESTORE_SCRIPT" --target "$REHEARSAL_TARGET" --into-postgres --keep) ||
  {
    history_append repetition-echouee "$REVISION" "restauration impossible"
    write_state "${DEPLOYED:-}" "$PREVIOUS" "$REVISION"
    FAILURE_RECORDED=1
    die "restauration impossible — déploiement arrêté, la production n'a pas bougé"
  }

REHEARSAL_DSN=$(printf '%s\n' "$REHEARSAL_OUTPUT" | sed -n 's/^dsn: //p')
[ -n "$REHEARSAL_DSN" ] ||
  die "aucune ligne « dsn: » dans la sortie de $RESTORE_SCRIPT — contrat rompu"

log "récupération de l'image de migration"
docker pull --quiet "${REGISTRY}/${MIGRATE_SERVICE}:${REVISION}" >/dev/null

read -ra MIGRATE_ARGV <<<"$MIGRATE_COMMAND"

if ! docker run --rm --network host \
  --env DATABASE_URL="$REHEARSAL_DSN" \
  "${REGISTRY}/${MIGRATE_SERVICE}:${REVISION}" \
  "${MIGRATE_ARGV[@]}"; then
  history_append repetition-echouee "$REVISION" "migration refusée par la copie restaurée"
  write_state "${DEPLOYED:-}" "$PREVIOUS" "$REVISION"
  FAILURE_RECORDED=1
  die "la migration échoue sur la restauration — déploiement arrêté, production intacte"
fi

log "répétition réussie"
cleanup_rehearsal

# --- 2. Récupération, migration réelle, redémarrage ------------------------

log "reprise de la pile et du routage en $REVISION"
sync_stack "$REVISION"

log "récupération des images en $REVISION"
compose_at "$REVISION" pull --quiet

log "démarrage de la base"
compose_at "$REVISION" up --detach --no-recreate db

log "migration réelle"
if ! compose_at "$REVISION" run --rm --no-deps "$MIGRATE_SERVICE" "${MIGRATE_ARGV[@]}"; then
  history_append migration-echouee "$REVISION" "migration réelle en échec"
  write_state "${DEPLOYED:-}" "$PREVIOUS" "$REVISION"
  FAILURE_RECORDED=1
  die "migration réelle en échec — les images n'ont pas été basculées"
fi

log "redémarrage sur $REVISION"
compose_at "$REVISION" up --detach --remove-orphans

# --- 3. Vérification de santé, et retour arrière si elle échoue ------------

if health_ok; then
  write_state "$REVISION" "${DEPLOYED:-}" ""
  history_append succes "$REVISION" "santé vérifiée"
  trap - EXIT
  heartbeat success
  log "déploiement de $REVISION terminé"
  exit 0
fi

log "santé en échec sur $REVISION"
history_append sante-echouee "$REVISION" "retour arrière engagé"

if [ -z "$DEPLOYED" ]; then
  write_state "" "" "$REVISION"
  FAILURE_RECORDED=1
  die "santé en échec et aucune version précédente — la pile reste sur $REVISION, intervention nécessaire"
fi

log "retour aux images $DEPLOYED — la base n'est pas touchée (ADR 0024)"
sync_stack "$DEPLOYED"
compose_at "$DEPLOYED" up --detach --force-recreate

if health_ok; then
  write_state "$DEPLOYED" "$PREVIOUS" "$REVISION"
  history_append retour-arriere "$DEPLOYED" "après échec de $REVISION"
  FAILURE_RECORDED=1
  die "santé en échec sur $REVISION — retour arrière effectué sur $DEPLOYED"
fi

write_state "$DEPLOYED" "$PREVIOUS" "$REVISION"
history_append retour-arriere-echoue "$DEPLOYED" "après échec de $REVISION"
FAILURE_RECORDED=1
die "santé en échec sur $REVISION et retour arrière infructueux — intervention nécessaire"
