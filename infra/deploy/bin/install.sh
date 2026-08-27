#!/usr/bin/env bash
#   install.sh [--prefix /opt/personal-os/deploy]
#
# Installe l'agent de déploiement, la pile de production et les unités systemd.
# Idempotent : se relance à chaque fois que l'agent lui-même change.
#
set -euo pipefail

PREFIX=/opt/personal-os/deploy
STACK_DIR=/opt/personal-os
CONF_DIR=/etc/personal-os
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
install -m 755 "$SOURCE_DIR"/bin/*.sh "$PREFIX/bin/"
install -m 644 "$SOURCE_DIR"/lib/*.sh "$PREFIX/lib/"

install -d -m 755 "$STACK_DIR" "$STACK_DIR/caddy" "$STACK_DIR/caddy/conf.d"
install -m 644 "$SOURCE_DIR/docker-compose.prod.yml" "$STACK_DIR/docker-compose.yml"
install -m 644 "$SOURCE_DIR/caddy/Caddyfile" "$STACK_DIR/caddy/Caddyfile"
for block in "$SOURCE_DIR"/caddy/conf.d/*; do
  [ -e "$block" ] || continue
  install -m 644 "$block" "$STACK_DIR/caddy/conf.d/$(basename "$block")"
done

install -d -m 700 "$CONF_DIR"
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

if [ -r "$CONF_DIR/ghcr.env" ]; then
  # shellcheck disable=SC1091
  . "$CONF_DIR/ghcr.env"
  if [ -n "${GHCR_TOKEN:-}" ]; then
    printf '%s' "$GHCR_TOKEN" |
      docker login ghcr.io --username "${GHCR_USERNAME:?GHCR_USERNAME manquant}" --password-stdin
    echo "connecté à ghcr.io" >&2
  fi
fi

install -m 644 "$SOURCE_DIR"/systemd/*.service "$SOURCE_DIR"/systemd/*.timer "$UNIT_DIR/"

systemctl daemon-reload

if systemctl is-enabled --quiet personal-os-deploy.timer 2>/dev/null; then
  systemctl restart personal-os-deploy.timer
  echo "installé. Timer déjà armé, rechargé :" >&2
  systemctl list-timers personal-os-deploy.timer --no-pager >&2
else
  cat >&2 <<'FIN'
installé. Le timer n'est PAS armé — c'est volontaire.

Renseigner la configuration, vérifier le plan, puis armer :

  sudo -e /opt/personal-os/.env
  sudo -e /etc/personal-os/deploy.conf
  sudo /opt/personal-os/deploy/bin/deploy.sh --dry-run
  sudo /opt/personal-os/deploy/bin/deploy.sh
  sudo systemctl enable --now personal-os-deploy.timer
FIN
fi
