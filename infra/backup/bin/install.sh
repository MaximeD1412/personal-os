#!/usr/bin/env bash
#   install.sh [--prefix /opt/personal-os/backup]
#
# Installe les scripts et les unités systemd sur la machine. Idempotent : se
# relance après chaque déploiement sans rien perdre.
#
set -euo pipefail

PREFIX=/opt/personal-os/backup
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

install -d -m 755 "$PREFIX/bin" "$PREFIX/lib"
install -m 755 "$SOURCE_DIR"/bin/*.sh "$PREFIX/bin/"
install -m 644 "$SOURCE_DIR"/lib/*.sh "$PREFIX/lib/"

install -d -m 700 "$CONF_DIR"

if [ ! -e "$CONF_DIR/backup.conf" ]; then
  install -m 640 "$SOURCE_DIR/backup.conf.example" "$CONF_DIR/backup.conf"
  echo "configuration initiale posée : $CONF_DIR/backup.conf — à relire" >&2
fi

if [ ! -e "$CONF_DIR/restic.env" ]; then
  install -m 600 "$SOURCE_DIR/restic.env.example" "$CONF_DIR/restic.env"
  echo "MODÈLE de secrets posé : $CONF_DIR/restic.env — à renseigner sur cette machine" >&2
fi

install -m 644 "$SOURCE_DIR"/systemd/*.service "$SOURCE_DIR"/systemd/*.timer "$UNIT_DIR/"

systemctl daemon-reload
systemctl enable --now personal-os-backup.timer

echo "installé. Prochaine sauvegarde :" >&2
systemctl list-timers personal-os-backup.timer --no-pager >&2
