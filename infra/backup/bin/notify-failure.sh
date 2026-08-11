#!/usr/bin/env bash
#
#   notify-failure.sh <nom-d-unité>
#
# Appelé par la directive OnFailure= des unités systemd. Envoie un courriel
# contenant les dernières lignes du journal, et marque le témoin d'inactivité en
# échec pour que l'alerte parte même si le courriel n'arrive jamais.
#
# Deux canaux parce qu'ils tombent en panne différemment : le courriel dit
# *pourquoi* mais dépend d'un relais SMTP, le témoin dit *que* mais ne sait rien
# du contexte. Perdre les deux à la fois demande deux pannes simultanées.
set -euo pipefail

LOG_TAG=alerte
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/common.sh
. "$SCRIPT_DIR/../lib/common.sh"

UNIT="${1:-inconnue}"

# Une alerte ne doit pas dépendre d'une configuration valide : c'est précisément
# quand la configuration est cassée qu'il faut être prévenu. On charge ce qu'on
# peut, et on continue quoi qu'il arrive.
load_config || true

JOURNAL=$(journalctl --unit "$UNIT" --lines 50 --no-pager 2>/dev/null ||
  echo '(journal indisponible)')

heartbeat fail || true

if [ -z "${BACKUP_ALERT_EMAIL:-}" ]; then
  log "BACKUP_ALERT_EMAIL absent — pas de courriel envoyé pour $UNIT"
  exit 0
fi

if ! command -v sendmail >/dev/null 2>&1; then
  log "sendmail introuvable — pas de courriel envoyé pour $UNIT"
  exit 0
fi

sendmail -t <<EOF
To: ${BACKUP_ALERT_EMAIL}
Subject: [Personal OS] échec de ${UNIT} sur $(hostname)
Content-Type: text/plain; charset=UTF-8

L'unité ${UNIT} a échoué sur $(hostname) le $(date -u +%Y-%m-%dT%H:%M:%SZ).

Dernières lignes du journal :

${JOURNAL}
EOF

log "courriel d'alerte envoyé à $BACKUP_ALERT_EMAIL pour $UNIT"
