#!/usr/bin/env bash
# Fonctions partagées par les scripts de déploiement.
#
# Ce fichier est *sourcé*, jamais exécuté. Il ne doit donc rien faire au
# chargement : pas de `set -e` (c'est à l'appelant de le poser), pas d'effet de
# bord, uniquement des définitions.
#
# `log` et `die` sont volontairement recopiés depuis infra/backup plutôt que
# partagés. Les deux composants s'installent séparément, et le déploiement doit
# pouvoir signaler « la sauvegarde n'est pas installée » — ce qu'il ne pourrait
# pas faire s'il avait besoin d'elle pour parler.

# Emplacements par défaut, surchargeables pour les tests.
: "${DEPLOY_CONF:=/etc/personal-os/deploy.conf}"
: "${GHCR_ENV_FILE:=/etc/personal-os/ghcr.env}"

log() {
  # L'horodatage est en UTC : le journal est relu depuis une autre machine, et
  # un décalage d'heure d'été dans une chronologie d'incident coûte cher.
  printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${LOG_TAG:-deploy}" "$*" >&2
}

die() {
  log "ERREUR: $*"
  exit 1
}

plan() { printf 'plan: %s\n' "$*"; }

# Charge la configuration puis les identifiants de registre.
#
# L'ordre compte, comme pour la sauvegarde : la configuration est versionnée et
# lisible, les identifiants ne le sont pas. Charger les seconds en dernier
# garantit qu'une variable oubliée dans la première ne peut pas les écraser.
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

# Une révision est un commit, jamais un tag mouvant.
#
# C'est la condition du retour arrière : `main` désigne une image différente
# demain, donc y revenir ne ramènerait pas la version d'avant. Refuser tôt vaut
# mieux que découvrir le problème le jour de l'incident.
assert_revision() {
  local revision="$1"
  [ -n "$revision" ] || die "révision vide"
  case "$revision" in
    *[!0-9a-f]*) die "révision mouvante ou malformée : $revision — un commit est attendu" ;;
  esac
  [ "${#revision}" -ge 7 ] || die "révision trop courte : $revision"
}

# Révision publiée sur le canal, lue dans le libellé OCI de l'image.
#
# On interroge le registre, pas GitHub : l'agent n'a aucun droit sur le dépôt,
# et le sens « tiré » veut que la seule source de vérité accessible d'ici soit
# ce qui a réellement été publié. `imagetools inspect` ne télécharge que le
# manifeste et la configuration — quelques kilo-octets, pas l'image.
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

# Dernière révision qui a échoué. Elle est mémorisée pour ne pas être rejouée à
# chaque passage du timer : un déploiement cassé remettrait sinon la production
# à l'épreuve toutes les deux minutes, et noierait son propre signalement.
failed_revision() {
  [ -r "$DEPLOY_STATE_FILE" ] || return 0
  # shellcheck disable=SC1090
  ( . "$DEPLOY_STATE_FILE"; printf '%s' "${FAILED_REVISION:-}" )
}

# Enregistre la version en place, celle d'avant, et celle qui a échoué.
#
# Écriture atomique : un état à moitié écrit — parce que la machine s'éteint
# pendant un déploiement — ferait croire à l'exécution suivante qu'aucune
# version n'est en place, et lui ferait tout redéployer sans cible de retour.
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

# Trace lisible sur la machine (§16.1). Le journal systemd dit *comment* s'est
# passé le dernier déploiement ; ce fichier dit *ce qui a été déployé et quand*,
# et survit à la rotation du journal.
history_append() {
  local event="$1" revision="$2" detail="${3:-}"
  local dir
  dir=$(dirname "$DEPLOY_HISTORY_FILE")
  mkdir -p "$dir"
  printf '%s\t%s\t%s\t%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$event" "$revision" "$detail" \
    >>"$DEPLOY_HISTORY_FILE"
}

# Reprend la pile et le routage du dépôt, à la révision déployée.
#
# Sans ce geste, une livraison qui ajoute un service ou une route publierait
# ses images sans jamais publier la configuration qui les branche : la machine
# resterait sur le compose du jour de l'installation. L'ADR 0023 veut le
# contraire — l'agent fait partie du produit, et ce qu'il déploie est versionné.
#
# Le dépôt est public : ce clone ne demande aucun identifiant, et il a un
# second usage — relire sur la machine le code exactement tel qu'il tourne.
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
  # Copie, jamais synchronisation : un bloc activé à la main sur la machine
  # (celui du tableau de bord, quand #5 l'ouvrira) ne doit pas disparaître
  # parce qu'il n'existe pas sous ce nom dans le dépôt.
  for block in "$source"/caddy/conf.d/*; do
    [ -e "$block" ] || continue
    install -m 644 "$block" "$CADDY_DIR/conf.d/$(basename "$block")"
  done

  # L'agent lui-même et ses unités systemd ne se mettent pas à jour tout seuls :
  # un script qui se réécrit pendant qu'il s'exécute est une source de pannes
  # difficiles à lire. La dérive est signalée, pas corrigée en silence.
  if ! diff --recursive --brief "$source/bin" "$DEPLOY_PREFIX/bin" >/dev/null 2>&1 ||
    ! diff --recursive --brief "$source/lib" "$DEPLOY_PREFIX/lib" >/dev/null 2>&1; then
    log "ATTENTION: l'agent installé diffère de la révision $revision — relancer $source/bin/install.sh"
  fi
}

# Enveloppe `docker compose` sur la pile de production, à une révision donnée.
#
# IMAGE_TAG est passé par l'environnement plutôt qu'écrit dans le fichier
# d'environnement : la révision en cours d'essai ne doit pas devenir la
# configuration persistante de la machine tant que la santé n'est pas vérifiée.
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

# Attend que l'API réponde. Une pile qui démarre n'est pas une pile qui marche.
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

# Signale l'état d'une exécution au témoin d'inactivité.
#
# Même raison que pour la sauvegarde : le déploiement n'apparaît pas dans
# l'interface GitHub (ADR 0023), et un agent qui a cessé de tourner ne produit
# aucun échec à signaler. Seule l'absence de ping le révèle.
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
