#!/usr/bin/env bash
# Déploie ce commit sur le staging de démonstration (ADR 0031).
#
#   deploy-staging.sh <commit> [--dry-run]
#
#   <commit>     le commit dont les images sont publiées (SHA, pas de branche)
#   --dry-run    imprime le plan, n'exécute rien
#
# Tire les images du commit, migre la base du staging, la remet au jeu de démo,
# redémarre le projet du staging et vérifie sa santé. Ne touche jamais au
# projet de la prod : ni à ses conteneurs, ni à sa base, ni à son clone.
#
# Pas de répétition sur restauration ni de retour arrière : le staging n'a
# aucune donnée réelle, et chaque déploiement repart du jeu de démo.
#
set -euo pipefail

LOG_TAG=staging
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/common.sh
. "$SCRIPT_DIR/../lib/common.sh"

REVISION=""
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      sed -n '2,7p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    -*) die "argument inconnu : $1" ;;
    *)
      [ -z "$REVISION" ] || die "un seul commit attendu : $REVISION, puis $1"
      REVISION="$1"
      ;;
  esac
  shift
done

[ -n "$REVISION" ] || die "usage : deploy-staging.sh <commit> [--dry-run]"

load_config

: "${STAGING_COMPOSE_FILE:=/opt/personal-os-staging/docker-compose.yml}"
: "${STAGING_ENV_FILE:=/opt/personal-os-staging/.env}"
: "${STAGING_PROJECT:=personal-os-staging}"
: "${STAGING_SOURCE_CHECKOUT:=/opt/personal-os-staging/src}"
: "${STAGING_EDGE_NETWORK:=personal-os-staging-edge}"
: "${STAGING_CHECK_COMMAND:=node verifier-environnement.js}"
: "${STAGING_SEED_COMMAND:=node demo-seed.js}"
: "${STAGING_HEALTH_URL:=http://127.0.0.1:3101/api/health}"
: "${STAGING_HISTORY_FILE:=/var/log/personal-os/deploy-staging.log}"

# --- Garde-fous, avant tout effet de bord ---------------------------------
#
# Le staging se distingue de la prod par sa configuration seule : un nom de
# projet, une pile ou un environnement recopiés de la prod feraient de ce
# script un déploiement de la prod, semis du jeu de démo compris.

assert_revision "$REVISION"

[ "$STAGING_PROJECT" != "$COMPOSE_PROJECT" ] ||
  die "STAGING_PROJECT vaut $COMPOSE_PROJECT, le projet de la prod — refusé"
[ "$STAGING_COMPOSE_FILE" != "$COMPOSE_FILE" ] ||
  die "STAGING_COMPOSE_FILE est la pile de la prod ($COMPOSE_FILE) — refusé"
[ "$STAGING_ENV_FILE" != "$COMPOSE_ENV_FILE" ] ||
  die "STAGING_ENV_FILE est l'environnement de la prod ($COMPOSE_ENV_FILE) — refusé"
[ "$STAGING_SOURCE_CHECKOUT" != "$SOURCE_CHECKOUT" ] ||
  die "STAGING_SOURCE_CHECKOUT est le clone de la prod ($SOURCE_CHECKOUT) — refusé"

[ -r "$STAGING_ENV_FILE" ] ||
  die "environnement du staging illisible : $STAGING_ENV_FILE — voir staging.env.example"
grep -qx 'APP_ENV=staging' "$STAGING_ENV_FILE" ||
  die "$STAGING_ENV_FILE ne pose pas APP_ENV=staging — ce n'est pas un environnement de staging"

read -ra CHECK_ARGV <<<"$STAGING_CHECK_COMMAND"
read -ra MIGRATE_ARGV <<<"$MIGRATE_COMMAND"
read -ra SEED_ARGV <<<"$STAGING_SEED_COMMAND"

if [ "$DRY_RUN" = 1 ]; then
  plan "staging ${STAGING_PROJECT} en ${REVISION} — ${COMPOSE_PROJECT} (prod) non touché"
  plan "pile reprise de ${STAGING_SOURCE_CHECKOUT} en ${REVISION} vers ${STAGING_COMPOSE_FILE}"
  plan "réseau ${STAGING_EDGE_NETWORK} créé s'il manque"
  plan "docker compose pull (${IMAGES}) en ${REVISION}"
  plan "base du staging démarrée"
  plan "arrêt des services applicatifs du staging (api, tableau de bord, portfolio) — plafond total tenu pendant les commandes jetables"
  plan "vérification de l'environnement ${STAGING_CHECK_COMMAND} sur le service ${MIGRATE_SERVICE}"
  plan "migration ${MIGRATE_COMMAND} sur le service ${MIGRATE_SERVICE}"
  plan "semis ${STAGING_SEED_COMMAND} — la base est remise au jeu de démo"
  plan "docker compose up --detach --remove-orphans --force-recreate"
  plan "santé ${STAGING_HEALTH_URL} (${HEALTH_RETRIES} essais, ${HEALTH_DELAY} s)"
  plan "si la santé échoue : arrêt, aucun retour arrière — le staging n'a aucune donnée réelle"
  exit 0
fi

for tool in docker curl git; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool est absent de la machine"
done

DEPLOY_HISTORY_FILE="$STAGING_HISTORY_FILE"
HEALTH_URL="$STAGING_HEALTH_URL"

# Compose préfère une variable du shell à celle de --env-file : un
# DATABASE_URL hérité de l'appelant passerait devant celui du staging. Il ne
# reçoit donc que ce qu'il faut pour joindre Docker et le registre, et le
# fichier d'environnement du staging reste sa seule source.
compose_staging() {
  env -i \
    PATH="$PATH" HOME="${HOME:-/root}" \
    ${DOCKER_HOST:+DOCKER_HOST="$DOCKER_HOST"} \
    ${DOCKER_CONFIG:+DOCKER_CONFIG="$DOCKER_CONFIG"} \
    ${DOCKER_CONTEXT:+DOCKER_CONTEXT="$DOCKER_CONTEXT"} \
    IMAGE_TAG="$REVISION" REGISTRY="$REGISTRY" STAGING_EDGE_NETWORK="$STAGING_EDGE_NETWORK" \
    docker compose \
    --file "$STAGING_COMPOSE_FILE" \
    --env-file "$STAGING_ENV_FILE" \
    --project-name "$STAGING_PROJECT" \
    "$@"
}

echouer() {
  history_append "$1" "$REVISION" "$2"
  FAILURE_RECORDED=1
  die "$2 — le staging est arrêté en cours de route, la prod n'a pas bougé"
}

FAILURE_RECORDED=0
on_exit() {
  local code=$?
  if [ "$code" -ne 0 ] && [ "$FAILURE_RECORDED" != 1 ]; then
    history_append echec-inattendu "$REVISION" "sortie $code"
  fi
  return $code
}
trap on_exit EXIT

log "déploiement du staging en $REVISION"
history_append debut "$REVISION" "$STAGING_PROJECT"

# --- 1. La pile, depuis le clone du staging ------------------------------
#
# Un clone à lui : celui de la prod reste sur la révision de la prod.

[ -d "$STAGING_SOURCE_CHECKOUT/.git" ] ||
  die "clone du dépôt absent : $STAGING_SOURCE_CHECKOUT — voir install.sh"
git -C "$STAGING_SOURCE_CHECKOUT" fetch --quiet origin ||
  die "impossible de récupérer les branches depuis l'origine"
git -C "$STAGING_SOURCE_CHECKOUT" checkout --quiet --detach "$REVISION" ||
  die "révision $REVISION absente du dépôt"
install -d -m 755 "$(dirname "$STAGING_COMPOSE_FILE")"
install -m 644 "$STAGING_SOURCE_CHECKOUT/infra/deploy/docker-compose.staging.yml" \
  "$STAGING_COMPOSE_FILE"

# --- 2. Le réseau partagé avec le Caddy de la prod ------------------------

if ! docker network inspect "$STAGING_EDGE_NETWORK" >/dev/null 2>&1; then
  log "création du réseau $STAGING_EDGE_NETWORK"
  docker network create "$STAGING_EDGE_NETWORK" >/dev/null
fi

# --- 3. Images, base, vérification, migration, semis ----------------------

log "récupération des images en $REVISION"
compose_staging pull --quiet

log "démarrage de la base du staging"
compose_staging up --detach --wait db

# Chaque `run` ajoute un conteneur `api` à ceux qui tournent : laissés en
# marche, les services applicatifs porteraient le staging à 1,40 CPU et
# 1 472 Mio, au-dessus de son plafond total. Ils s'arrêtent donc d'abord ; le
# staging est de toute façon remis à zéro.
log "arrêt des services applicatifs du staging"
compose_staging stop api staging-dashboard staging-portfolio

# La migration et le semis passent par `run`, sans le démarrage de l'API et
# donc sans son garde-fou : la même vérification les précède, dans la même
# image et le même environnement. Le semis vide les données métier.
log "vérification de l'environnement"
compose_staging run --rm --no-deps "$MIGRATE_SERVICE" "${CHECK_ARGV[@]}" ||
  echouer environnement-refuse "environnement du staging refusé par l'image"

log "migration"
compose_staging run --rm --no-deps "$MIGRATE_SERVICE" "${MIGRATE_ARGV[@]}" ||
  echouer migration-echouee "migration en échec"

log "semis du jeu de démo"
compose_staging run --rm --no-deps "$MIGRATE_SERVICE" "${SEED_ARGV[@]}" ||
  echouer semis-echoue "semis du jeu de démo en échec"

# --- 4. Redémarrage et santé ----------------------------------------------

log "redémarrage du staging en $REVISION"
compose_staging up --detach --remove-orphans --force-recreate

if ! health_ok; then
  echouer sante-echouee "santé en échec sur $STAGING_HEALTH_URL"
fi

history_append succes "$REVISION" "santé vérifiée"
trap - EXIT
log "staging en $REVISION, remis au jeu de démo"
