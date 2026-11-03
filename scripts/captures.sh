#!/usr/bin/env bash
# Captures des écrans du tableau de bord pour la revue visuelle (AGENTS.md,
# « Revue visuelle ») : chaque chemin en mobile (390×844) et en desktop
# (1280×800), sous une Session de démo qui n'existe que le temps de la capture.
#
#   scripts/captures.sh <chemin> [<chemin>…]
#   scripts/captures.sh /agenda '/calendrier/evenements/nouveau?titre=Dîner'
#
# Prérequis : la pile locale lancée (tableau de bord et API) et le jeu de démo
# semé (`pnpm demo:seed`). La Session appartient au premier Compte de
# `DEMO_ACCOUNT_EMAILS` ; elle est supprimée à la sortie, même en cas d'échec
# ou d'interruption, et ne vit de toute façon qu'une demi-heure. La commande
# refuse de tourner avec APP_ENV=production.
#
# Variables : CAPTURES_URL (origine du tableau de bord, http://localhost:4200
# par défaut), CAPTURES_DIR (dossier de sortie, captures/ par défaut). Les
# variables de .env sont lues, sans écraser celles de l'environnement.
set -euo pipefail

if (($# == 0)); then
  echo "Usage : scripts/captures.sh <chemin> [<chemin>…]   (ex. /agenda)" >&2
  exit 2
fi

racine=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$racine"

origine=${CAPTURES_URL:-http://localhost:${DASHBOARD_PORT:-4200}}
origine=${origine%/}
sortie=${CAPTURES_DIR:-captures}
navigateur="captures-$$"

fail() {
  echo "ÉCHEC : $*" >&2
  exit 1
}

# Le script TS de la Session de démo, lancé comme `pnpm demo:seed`, avec .env.
# Des options ts-node héritées (l'exécuteur jest de nx en pose) ne s'appliquent
# pas : seul le tsconfig du paquet compte.
session() {
  env -u TS_NODE_COMPILER_OPTIONS DOTENV_CONFIG_QUIET=true \
    TS_NODE_PROJECT=packages/database/tsconfig.lib.json TS_NODE_BASEURL="$racine" \
    node_modules/.bin/ts-node --transpile-only -r dotenv/config -r tsconfig-paths/register \
    packages/database/src/demo/session.ts "$@"
}

ab() {
  agent-browser --session "$navigateur" "$@"
}

# Le nom de fichier d'un chemin : /calendrier/evenements/nouveau?titre=x donne
# calendrier-evenements-nouveau-titre-x, et / donne accueil.
slug() {
  local s
  s=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')
  s=${s#-}
  s=${s%-}
  printf '%s' "${s:-accueil}"
}

# Le jeton est tiré ici, avant que la Session n'existe en base : le nettoyage
# sait toujours quoi supprimer, même si une interruption tombe pendant sa
# création. Il passe à session.ts par l'entrée standard, jamais en argument.
token=$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")
session_ouverte=""
navigateur_ouvert=""
nettoyer() {
  local code=$?
  trap - EXIT INT TERM
  if [[ -n "$navigateur_ouvert" ]]; then
    ab close >/dev/null 2>&1 || true
  fi
  if [[ -n "$session_ouverte" ]]; then
    session fermer <<<"$token" ||
      echo "ATTENTION : la Session de capture n'a pas pu être supprimée (elle expire d'elle-même sous une demi-heure)." >&2
  fi
  exit "$code"
}
# Le piège est posé avant la création de la Session : une interruption à
# n'importe quel moment passe par le nettoyage.
trap nettoyer EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

session_ouverte=1
session ouvrir <<<"$token" || {
  session_ouverte=""
  fail "Session de capture non ouverte (voir ci-dessus)."
}

curl -fsS -o /dev/null -H @- "$origine/api/auth/me" <<<"Cookie: pos_session=$token" ||
  fail "$origine/api/auth/me ne reconnaît pas la Session de capture : la pile locale tourne-t-elle sur la même base que DATABASE_URL ?"

mkdir -p "$sortie"
navigateur_ouvert=1
ab cookies set pos_session "$token" --url "$origine/" --httpOnly --sameSite Lax >/dev/null ||
  fail "cookie de session non posé dans agent-browser"

# Ouvre la page, attend qu'elle se pose, vérifie qu'elle n'a pas été renvoyée
# vers la connexion, puis la photographie. Appelée derrière `||`, elle ne
# profite pas de `set -e` : chaque étape vérifie son code.
capturer() {
  local chemin=$1 largeur=$2 hauteur=$3 fichier=$4 url
  ab set viewport "$largeur" "$hauteur" >/dev/null || return 1
  ab open "$origine$chemin" >/dev/null || return 1
  ab wait --load networkidle >/dev/null || return 1
  url=$(ab get url) || return 1
  if [[ "$url" != "$origine"* || "$url" == *"/api/auth/"* ]]; then
    fail "$chemin a mené à $url : la page n'est pas affichée sous la Session de capture."
  fi
  ab screenshot "$fichier" >/dev/null || return 1
  echo "$fichier"
}

for chemin in "$@"; do
  [[ "$chemin" == /* ]] || chemin="/$chemin"
  nom=$(slug "$chemin")
  capturer "$chemin" 390 844 "$sortie/$nom-mobile.png" || fail "capture mobile de $chemin"
  capturer "$chemin" 1280 800 "$sortie/$nom-desktop.png" || fail "capture desktop de $chemin"
done
