#!/usr/bin/env bash
# Un faux `agent-browser` pour `src/demo/captures.integration-spec.ts` : il note
# ses appels, retient le cookie posé et, à chaque `open`, présente ce cookie à
# `/api/auth/me` comme le ferait le navigateur. `screenshot` écrit un fichier.
# `FAUX_ECHEC=<commande>` fait échouer cette commande, `FAUX_PAUSE=<s>` fait
# durer `open`.
set -euo pipefail
etat="$FAUX_ETAT"
args=("$@")
while [[ "${args[0]}" == --* ]]; do args=("${args[@]:2}"); done
echo "${args[*]}" >>"$etat/appels"
if [[ "${FAUX_ECHEC:-}" == "${args[0]}" ]]; then
  echo "échec simulé" >&2
  exit 1
fi
case "${args[0]}" in
  cookies) echo "${args[3]}" >"$etat/cookie" ;;
  open)
    sleep "${FAUX_PAUSE:-0}"
    echo "${args[1]}" >"$etat/url"
    origine=$(echo "${args[1]}" | sed -E 's#^(https?://[^/]+).*#\1#')
    curl -fsS -o /dev/null -b "pos_session=$(cat "$etat/cookie" 2>/dev/null)" \
      "$origine/api/auth/me"
    ;;
  get) cat "$etat/url" ;;
  screenshot) echo "capture" >"${args[1]}" ;;
esac
