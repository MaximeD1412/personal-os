#!/usr/bin/env bash
#   notify-failure.sh <ce-qui-a-échoué> <journal>
#
# Appelé par deploy-trigger quand un déploiement sort en échec. Envoie un
# courriel contenant les dernières lignes du journal du déploiement.
#
# Le job GitHub est déjà rouge : le courriel sert à qui ne le regarde pas, et
# garde une trace sur la machine si la session SSH a été coupée. Le témoin
# d'inactivité, lui, est marqué en échec par deploy.sh.
#
set -euo pipefail

LOG_TAG=alerte-deploiement
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/common.sh
. "$SCRIPT_DIR/../lib/common.sh"

QUOI="${1:-déploiement}"
FICHIER="${2:-}"

load_config || true

if [ -n "$FICHIER" ] && [ -r "$FICHIER" ]; then
  JOURNAL=$(tail -n 50 "$FICHIER")
else
  JOURNAL='(journal indisponible)'
fi

if [ -z "${DEPLOY_ALERT_EMAIL:-}" ]; then
  log "DEPLOY_ALERT_EMAIL absent — pas de courriel envoyé pour : $QUOI"
  exit 0
fi

if ! command -v sendmail >/dev/null 2>&1; then
  log "sendmail introuvable — pas de courriel envoyé pour : $QUOI"
  exit 0
fi

sendmail -t <<EOF
To: ${DEPLOY_ALERT_EMAIL}
Subject: [Personal OS] échec : ${QUOI} sur $(hostname)
Content-Type: text/plain; charset=UTF-8

${QUOI} a échoué sur $(hostname) le $(date -u +%Y-%m-%dT%H:%M:%SZ).

Révision de production en place : $(deployed_revision || echo inconnue)

Dernières lignes du journal (${FICHIER:-aucun}) :

${JOURNAL}
EOF

log "courriel d'alerte envoyé à $DEPLOY_ALERT_EMAIL pour : $QUOI"
