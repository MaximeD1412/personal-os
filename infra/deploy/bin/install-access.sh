#!/usr/bin/env bash
#   install-access.sh [--keys DIR] [--prefix DIR] [--print authorized_keys|sudoers]
#
# Pose l'accès bridé par lequel GitHub Actions déclenche un déploiement
# (ADR 0032) : l'utilisateur deploy, ses clés dans authorized_keys, chacune
# forcée sur « deploy-trigger <env> », et la règle sudo qui ne lui ouvre que
# deploy-trigger.
#
#   --keys     les clés publiques fournies par l'opérateur, prod.pub et
#              staging.pub (défaut /etc/personal-os/deploy-keys)
#   --prefix   emplacement de l'agent (défaut /opt/personal-os/deploy)
#   --print    imprime le fichier qui serait posé, ne touche à rien
#
# Lancé par install.sh. Idempotent : authorized_keys est réécrit en entier à
# partir des .pub, si bien que remplacer une clé et relancer retire l'ancienne.
#
set -euo pipefail
# Une clé refusée dans $(…) doit arrêter le script, pas la seule substitution.
shopt -s inherit_errexit

KEYS_DIR=/etc/personal-os/deploy-keys
PREFIX=/opt/personal-os/deploy
PRINT=""

UTILISATEUR=deploy
HOME_DIR=/home/deploy
# Le marqueur qui distingue notre utilisateur d'un « deploy » posé par un
# autre projet de la machine, dont on ne réécrira jamais les clés.
GECOS="Personal OS, deploiement pousse (ADR 0032)"
SUDOERS=/etc/sudoers.d/personal-os-deploy

ENVIRONNEMENTS=(prod staging)
OPTIONS="no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,restrict"

err() {
  printf 'install-access.sh: %s\n' "$*" >&2
}

die() {
  err "ERREUR: $*"
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --keys)
      KEYS_DIR="${2:-}"
      shift
      ;;
    --prefix)
      PREFIX="${2:-}"
      shift
      ;;
    --print)
      PRINT="${2:-}"
      shift
      ;;
    -h | --help)
      sed -n '2,15p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) die "argument inconnu : $1" ;;
  esac
  shift
done

# Le chemin entre dans command="…" et dans une règle sudo : un guillemet, une
# virgule ou une espace y changeraient le sens de la ligne.
[[ "$PREFIX" =~ ^/[A-Za-z0-9._/-]+$ ]] || die "préfixe refusé : $PREFIX"
TRIGGER="$PREFIX/bin/deploy-trigger"

# --- Les clés ------------------------------------------------------------

TYPES='ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com|ssh-rsa'

# Imprime « type corps » d'une clé publique, sans son commentaire. Un fichier
# qui contient autre chose qu'une seule clé nue est refusé : des options en
# tête ou une seconde ligne deviendraient une entrée d'authorized_keys sans
# commande forcée, c'est-à-dire un shell.
cle_nue() {
  local fichier="$1" contenu
  contenu=$(tr -d '\r' <"$fichier" | grep -v '^[[:space:]]*$' || true)

  [ -n "$contenu" ] || die "$fichier est vide"
  [ "$(printf '%s\n' "$contenu" | wc -l)" -eq 1 ] ||
    die "$fichier contient plusieurs lignes — une seule clé publique est attendue"
  [[ "$contenu" =~ ^($TYPES)\ ([A-Za-z0-9+/]+={0,2})(\ .*)?$ ]] ||
    die "$fichier n'est pas une clé publique nue (type, corps, commentaire), sans option devant"

  local cle="${BASH_REMATCH[1]} ${BASH_REMATCH[2]}"
  if command -v ssh-keygen >/dev/null 2>&1; then
    local essai
    essai=$(mktemp)
    printf '%s\n' "$cle" >"$essai"
    if ! ssh-keygen -l -f "$essai" >/dev/null 2>&1; then
      rm -f "$essai"
      die "$fichier : ssh-keygen ne reconnaît pas cette clé"
    fi
    rm -f "$essai"
  fi
  printf '%s' "$cle"
}

authorized_keys() {
  local env fichier cle lignes=() vues=()
  for env in "${ENVIRONNEMENTS[@]}"; do
    fichier="$KEYS_DIR/$env.pub"
    if [ ! -e "$fichier" ]; then
      err "pas de $fichier — GitHub ne pourra pas déployer $env"
      continue
    fi
    cle=$(cle_nue "$fichier")
    local deja
    for deja in "${vues[@]+"${vues[@]}"}"; do
      [ "$deja" != "$cle" ] ||
        die "$fichier est la clé d'un autre environnement — une clé par environnement"
    done
    vues+=("$cle")
    lignes+=("command=\"$TRIGGER $env\",$OPTIONS $cle personal-os-deploy-$env")
  done

  printf '%s\n' \
    "# Géré par infra/deploy/bin/install-access.sh (ADR 0032) : ne pas modifier à la main." \
    "# Chaque clé ne peut que lancer deploy-trigger pour son environnement."
  [ ${#lignes[@]} -eq 0 ] || printf '%s\n' "${lignes[@]}"
}

# --- La règle sudo ---------------------------------------------------------
#
# deploy-trigger se relance lui-même en root, avec l'environnement de la clé
# pour seul argument. sudo efface l'environnement : SSH_ORIGINAL_COMMAND est
# gardé pour que la copie root revérifie la demande.
sudoers() {
  cat <<EOF
# Géré par infra/deploy/bin/install-access.sh (ADR 0032) : ne pas modifier à la main.
# deploy ne peut lancer en root que deploy-trigger, qui n'accepte que
# « deploy <env> <sha> ».
Defaults!$TRIGGER env_keep += "SSH_ORIGINAL_COMMAND"
$UTILISATEUR ALL=(root) NOPASSWD: $TRIGGER prod, $TRIGGER staging
EOF
}

case "$PRINT" in
  authorized_keys)
    contenu=$(authorized_keys)
    printf '%s\n' "$contenu"
    exit 0
    ;;
  sudoers)
    sudoers
    exit 0
    ;;
  "") ;;
  *) die "--print attend authorized_keys ou sudoers, pas $PRINT" ;;
esac

# --- Pose -------------------------------------------------------------------

[ "$(id -u)" = 0 ] || die "install-access.sh doit être lancé en root"
for tool in sudo visudo useradd; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool est absent de la machine"
done

# Tout est vérifié avant le premier effet de bord : une clé refusée laisse
# l'accès précédent en place.
CLES=$(authorized_keys)

# L'utilisateur a un vrai shell, /bin/sh : sshd lance la commande forcée par
# le shell de l'utilisateur, et /usr/sbin/nologin la refuserait. Aucun shell
# n'est atteignable pour autant : pas de mot de passe, et chaque clé
# d'authorized_keys force deploy-trigger.
if getent passwd "$UTILISATEUR" >/dev/null; then
  [ "$(getent passwd "$UTILISATEUR" | cut -d: -f5)" = "$GECOS" ] ||
    die "un utilisateur $UTILISATEUR existe déjà, sans être celui de Personal OS — rien n'est touché"
  usermod --shell /bin/sh --home "$HOME_DIR" "$UTILISATEUR"
else
  useradd --system --user-group --no-create-home --home-dir "$HOME_DIR" \
    --shell /bin/sh --comment "$GECOS" "$UTILISATEUR"
  err "utilisateur $UTILISATEUR créé"
fi
# Aucun mot de passe ne lui ouvre de session. « * » plutôt qu'un compte
# verrouillé (« ! ») : sans PAM, sshd refuserait aussi les clés d'un compte
# verrouillé.
usermod --password '*' "$UTILISATEUR"

# Le dossier et ses clés appartiennent à root : deploy ne peut pas s'ajouter
# une clé, ni retirer la commande forcée de la sienne.
install -d -o root -g root -m 755 "$HOME_DIR" "$HOME_DIR/.ssh"

REGLE=$(mktemp)
trap 'rm -f "$REGLE"' EXIT
sudoers >"$REGLE"
visudo -cqf "$REGLE" >/dev/null || die "règle sudo refusée par visudo"
install -o root -g root -m 440 "$REGLE" "$SUDOERS"

printf '%s\n' "$CLES" >"$REGLE"
install -o root -g root -m 644 "$REGLE" "$HOME_DIR/.ssh/authorized_keys"

err "accès de déploiement posé : $(grep -c '^command=' "$HOME_DIR/.ssh/authorized_keys" || true) clé(s) dans $HOME_DIR/.ssh/authorized_keys"
