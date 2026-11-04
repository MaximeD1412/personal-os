#!/usr/bin/env bash
#   install.sh [--prefix /opt/personal-os/deploy]
#
# Installe l'agent de déploiement, la pile de production, celle du staging de
# démonstration et l'accès bridé par lequel GitHub déclenche un déploiement
# (ADR 0032). Retire le minuteur de l'ancien déploiement tiré, s'il est là.
# Idempotent : se relance à chaque fois que l'agent lui-même change.
#
set -euo pipefail

PREFIX=/opt/personal-os/deploy
STACK_DIR=/opt/personal-os
STAGING_DIR=/opt/personal-os-staging
CONF_DIR=/etc/personal-os
# Où l'ancien déploiement tiré posait son minuteur, retiré ci-dessous.
UNIT_DIR=/etc/systemd/system

while [ $# -gt 0 ]; do
  case "$1" in
    --prefix)
      PREFIX="${2:-}"
      shift
      ;;
    *)
      echo "argument inconnu : $1" >&2
      exit 1
      ;;
  esac
  shift
done

SOURCE_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

[ "$(id -u)" = 0 ] || {
  echo "install.sh doit être lancé en root" >&2
  exit 1
}

for tool in docker curl git; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "$tool est absent de la machine" >&2
    exit 1
  }
done

docker buildx version >/dev/null 2>&1 || {
  echo "docker buildx est absent — l'agent en a besoin pour lire la révision du canal" >&2
  exit 1
}

install -d -m 755 "$PREFIX/bin" "$PREFIX/lib"
install -m 755 "$SOURCE_DIR"/bin/*.sh "$SOURCE_DIR/bin/deploy-trigger" "$PREFIX/bin/"
install -m 644 "$SOURCE_DIR"/lib/*.sh "$PREFIX/lib/"

install -d -m 755 "$STACK_DIR" "$STACK_DIR/caddy" "$STACK_DIR/caddy/conf.d"
install -m 644 "$SOURCE_DIR/docker-compose.prod.yml" "$STACK_DIR/docker-compose.yml"
install -m 644 "$SOURCE_DIR/caddy/Caddyfile" "$STACK_DIR/caddy/Caddyfile"
for block in "$SOURCE_DIR"/caddy/conf.d/*; do
  [ -e "$block" ] || continue
  install -m 644 "$block" "$STACK_DIR/caddy/conf.d/$(basename "$block")"
done

install -d -m 700 "$CONF_DIR"
install -d -m 755 "$CONF_DIR/deploy-keys"
install -d -m 755 /var/lib/personal-os /var/log/personal-os

if [ ! -e "$CONF_DIR/deploy.conf" ]; then
  install -m 640 "$SOURCE_DIR/deploy.conf.example" "$CONF_DIR/deploy.conf"
  echo "configuration initiale posée : $CONF_DIR/deploy.conf — à relire" >&2
fi

if [ ! -e "$CONF_DIR/ghcr.env" ]; then
  install -m 600 "$SOURCE_DIR/ghcr.env.example" "$CONF_DIR/ghcr.env"
  echo "MODÈLE de secrets posé : $CONF_DIR/ghcr.env — à renseigner si les images sont privées" >&2
fi

if [ ! -e "$STACK_DIR/.env" ]; then
  install -m 600 "$SOURCE_DIR/stack.env.example" "$STACK_DIR/.env"
  echo "MODÈLE d'environnement posé : $STACK_DIR/.env — À RENSEIGNER avant tout démarrage" >&2
fi

SOURCE_REMOTE=${SOURCE_REMOTE:-https://github.com/MaximeD1412/personal-os.git}
if [ ! -d "$STACK_DIR/src/.git" ]; then
  git clone --quiet "$SOURCE_REMOTE" "$STACK_DIR/src"
  echo "dépôt cloné dans $STACK_DIR/src" >&2
fi

# --- Staging de démonstration (ADR 0031) -----------------------------------
#
# Son dossier, son environnement et son propre clone : deploy-staging.sh y
# extrait le commit qu'il déploie, sans jamais déplacer celui de la prod.
install -d -m 755 "$STAGING_DIR"
install -m 644 "$SOURCE_DIR/docker-compose.staging.yml" "$STAGING_DIR/docker-compose.yml"

if [ ! -e "$STAGING_DIR/.env" ]; then
  install -m 600 "$SOURCE_DIR/staging.env.example" "$STAGING_DIR/.env"
  echo "MODÈLE d'environnement du staging posé : $STAGING_DIR/.env — À RENSEIGNER avant tout déploiement du staging" >&2
fi

if [ ! -d "$STAGING_DIR/src/.git" ]; then
  git clone --quiet "$SOURCE_REMOTE" "$STAGING_DIR/src"
  echo "dépôt cloné dans $STAGING_DIR/src" >&2
fi

# Le réseau que le Caddy interne de la prod partage avec le staging. La pile de
# la prod l'exige pour démarrer, même quand le staging est arrêté.
STAGING_EDGE_NETWORK=$(
  # shellcheck disable=SC1091
  [ -r "$CONF_DIR/deploy.conf" ] && . "$CONF_DIR/deploy.conf"
  printf '%s' "${STAGING_EDGE_NETWORK:-personal-os-staging-edge}"
)
if ! docker network inspect "$STAGING_EDGE_NETWORK" >/dev/null 2>&1; then
  docker network create "$STAGING_EDGE_NETWORK" >/dev/null
  echo "réseau $STAGING_EDGE_NETWORK créé" >&2
fi

if [ -r "$CONF_DIR/ghcr.env" ]; then
  # shellcheck disable=SC1091
  . "$CONF_DIR/ghcr.env"
  if [ -n "${GHCR_TOKEN:-}" ]; then
    printf '%s' "$GHCR_TOKEN" |
      docker login ghcr.io --username "${GHCR_USERNAME:?GHCR_USERNAME manquant}" --password-stdin
    echo "connecté à ghcr.io" >&2
  fi
fi

# --- Accès de déploiement (ADR 0032) ---------------------------------------
#
# L'utilisateur deploy, ses clés forcées sur deploy-trigger et sa règle sudo.
# Les clés publiques sont celles que l'opérateur a posées dans deploy-keys/.
"$PREFIX/bin/install-access.sh" --keys "$CONF_DIR/deploy-keys" --prefix "$PREFIX"

# --- Retrait du minuteur ------------------------------------------------------
#
# Le déploiement n'est plus tiré par un minuteur, il est poussé par GitHub.
# Un déploiement lancé par l'ancien minuteur va jusqu'au bout : on attend sa
# fin plutôt que de l'arrêter au milieu d'une migration.
ANCIENNES_UNITES=(personal-os-deploy.timer personal-os-deploy.service personal-os-deploy-failure@.service)
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  systemctl disable --now personal-os-deploy.timer >/dev/null 2>&1 || true
  systemctl disable personal-os-deploy.service >/dev/null 2>&1 || true
  while [ "$(systemctl show -p ActiveState --value personal-os-deploy.service 2>/dev/null)" = activating ]; do
    echo "un déploiement lancé par l'ancien minuteur est en cours — attente de sa fin" >&2
    sleep 10
  done
fi
RETIREES=0
for unite in "${ANCIENNES_UNITES[@]}"; do
  if [ -e "$UNIT_DIR/$unite" ]; then
    rm -f "$UNIT_DIR/$unite"
    RETIREES=$((RETIREES + 1))
  fi
done
if [ "$RETIREES" -gt 0 ] && command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  systemctl daemon-reload
  systemctl reset-failed 'personal-os-deploy*' >/dev/null 2>&1 || true
  echo "minuteur de déploiement retiré : GitHub pousse désormais chaque déploiement" >&2
fi

cat >&2 <<'FIN'
installé. Rien ne se déploie tant que GitHub n'a pas de clé.

Renseigner la configuration, vérifier le plan, puis poser les clés :

  sudo -e /opt/personal-os/.env
  sudo -e /etc/personal-os/deploy.conf
  sudo /opt/personal-os/deploy/bin/deploy.sh --dry-run
  sudo install -m 644 prod.pub staging.pub /etc/personal-os/deploy-keys/
  sudo /opt/personal-os/src/infra/deploy/bin/install.sh

Le README de infra/deploy/ décrit la création des clés et des environnements
GitHub.
FIN
