#!/usr/bin/env bash
# Enveloppe le vrai node (`VRAI_NODE`) pour `src/demo/captures.integration-spec.ts`.
# Avec `FAUX_NODE_ECHEC_OUVERTURE`, `session.ts ouvrir` écrit sa Session puis
# sort en 143, comme un processus tué juste après l'écriture : le fichier
# `$FAUX_ETAT/session-creee` atteste que la Session existait bien.
set -uo pipefail
"$VRAI_NODE" "$@"
code=$?
if [[ -n "${FAUX_NODE_ECHEC_OUVERTURE:-}" && "$*" == *"session.ts ouvrir"* ]]; then
  ((code == 0)) && touch "$FAUX_ETAT/session-creee"
  exit 143
fi
exit "$code"
