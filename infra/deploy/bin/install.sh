#!/usr/bin/env bash
#
#   install.sh [--prefix /opt/personal-os/deploy]
#
# Installe l'agent de déploiement, la pile de production et les unités systemd.
# Idempotent : se relance à chaque fois que l'agent lui-même change.
#
# N'écrit JAMAIS de secret et n'écrase JAMAIS une configuration existante — le
# fichier de configuration, le fichier d'environnement de la pile et le fichier
# de secrets se posent à la main, une fois, et survivent aux mises à jour.
#
# L'agent, lui, ne se met pas à jour tout seul : un script qui se réécrit
# pendant qu'il s'exécute est une source de pannes difficiles à lire. Le
# déploiement signale la dérive dans le journal, et c'est ce script qui la
# corrige.
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

# `imagetools` lit la révision publiée sur le canal sans télécharger l'image.
# Son absence ne se verrait qu'au premier déploiement automatique, c'est-à-dire
# sans personne devant l'écran.
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
  # Le modèle est posé sans ses valeurs, et en 600 dès le départ : un fichier
  # créé en 644 puis corrigé a été lisible entre les deux.
  install -m 600 "$SOURCE_DIR/ghcr.env.example" "$CONF_DIR/ghcr.env"
  echo "MODÈLE de secrets posé : $CONF_DIR/ghcr.env — à renseigner si les images sont privées" >&2
fi

# L'environnement de la pile porte le mot de passe de la base : il se pose à la
# main et n'est jamais écrasé. Le changer sur un volume déjà initialisé ne
# change rien côté serveur, mais l'API construira sa chaîne de connexion avec
# la nouvelle valeur et ne se connectera plus.
if [ ! -e "$STACK_DIR/.env" ]; then
  install -m 600 "$SOURCE_DIR/stack.env.example" "$STACK_DIR/.env"
  echo "MODÈLE d'environnement posé : $STACK_DIR/.env — À RENSEIGNER avant tout démarrage" >&2
fi

# Clone du dépôt, d'où chaque déploiement reprend la pile et le routage.
SOURCE_REMOTE=${SOURCE_REMOTE:-https://github.com/MaximeD1412/personal-os.git}
if [ ! -d "$STACK_DIR/src/.git" ]; then
  git clone --quiet "$SOURCE_REMOTE" "$STACK_DIR/src"
  echo "dépôt cloné dans $STACK_DIR/src" >&2
fi

# Connexion au registre, uniquement si un jeton a été posé. Les images publiées
# depuis un dépôt public peuvent être publiques : dans ce cas la machine n'a
# besoin d'aucun identifiant, et il n'y en a donc aucun à faire fuir.
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

# Ce script **n'arme jamais le timer de lui-même.**
#
# Une première installation pose des modèles de configuration vides. Armer à
# cet instant déclenche un déploiement dans les deux minutes, avant que
# quiconque ait pu renseigner quoi que ce soit : il échoue, et il alerte — au
# moment précis où l'opérateur a les mains dans les fichiers et où une alerte
# ne lui apprend rien.
#
# Une réinstallation, elle, ne doit pas désarmer un timer en service. On se
# contente donc de le redémarrer pour qu'il reprenne les unités mises à jour.
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
