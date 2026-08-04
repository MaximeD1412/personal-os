#!/usr/bin/env bash
# Fonctions partagées par backup.sh et restore.sh.
#
# Ce fichier est *sourcé*, jamais exécuté. Il ne doit donc rien faire au
# chargement : pas de `set -e` (c'est à l'appelant de le poser), pas d'effet de
# bord, uniquement des définitions.

# Emplacements par défaut, surchargeables pour les tests.
: "${BACKUP_CONF:=/etc/personal-os/backup.conf}"
: "${RESTIC_ENV_FILE:=/etc/personal-os/restic.env}"

log() {
  # L'horodatage est en UTC : le journal est relu depuis une autre machine, et
  # un décalage d'heure d'été dans une chronologie d'incident coûte cher.
  printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${LOG_TAG:-backup}" "$*" >&2
}

die() {
  log "ERREUR: $*"
  exit 1
}

# Charge le fichier de configuration puis les secrets.
#
# L'ordre compte : la configuration est versionnée et lisible, les secrets ne le
# sont pas. Charger les secrets en dernier garantit qu'une variable oubliée dans
# la configuration ne peut pas écraser un identifiant.
load_config() {
  [ -r "$BACKUP_CONF" ] || die "configuration illisible : $BACKUP_CONF"
  # shellcheck disable=SC1090
  . "$BACKUP_CONF"

  if [ -r "$RESTIC_ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$RESTIC_ENV_FILE"
    set +a
  elif [ -z "${RESTIC_REPOSITORY:-}" ]; then
    die "ni $RESTIC_ENV_FILE ni RESTIC_REPOSITORY dans l'environnement"
  fi

  : "${POSTGRES_CONTAINER:=personal-os-db}"
  : "${POSTGRES_USER:=personalos}"
  : "${POSTGRES_DB:=personalos}"
  : "${KEEP_DAILY:=7}"
  : "${KEEP_WEEKLY:=4}"
  : "${KEEP_MONTHLY:=6}"
}

# Refuse de continuer si un secret Restic est posé ailleurs que sur la machine.
#
# RESTIC_PASSWORD en clair dans l'environnement se retrouve dans
# /proc/<pid>/environ, dans un `docker inspect`, et dans les traces d'un
# gestionnaire de processus. L'ADR 0020 veut le contraire : un fichier, sur
# cette machine, lisible par root seul.
assert_password_file() {
  [ -n "${RESTIC_PASSWORD_FILE:-}" ] ||
    die "RESTIC_PASSWORD_FILE absent — le mot de passe doit vivre dans un fichier, pas dans l'environnement"
  [ -z "${RESTIC_PASSWORD:-}" ] ||
    die "RESTIC_PASSWORD présent dans l'environnement — utiliser RESTIC_PASSWORD_FILE"

  if [ "${SKIP_PASSWORD_FILE_CHECKS:-0}" != 1 ]; then
    [ -r "$RESTIC_PASSWORD_FILE" ] || die "clé illisible : $RESTIC_PASSWORD_FILE"

    local mode
    mode=$(stat -c '%a' "$RESTIC_PASSWORD_FILE")
    case "$mode" in
      600 | 400) ;;
      *) die "clé $RESTIC_PASSWORD_FILE en mode $mode — attendu 600" ;;
    esac
  fi
}

# Politique de rétention, sur la sortie standard, un argument par ligne.
#
# Isolée ici parce que backup.sh et le banc d'essai de migration doivent
# appliquer exactement la même — une divergence ferait disparaître des
# instantanés que l'autre croit encore présents.
retention_args() {
  printf '%s\n' \
    --keep-daily "${KEEP_DAILY}" \
    --keep-weekly "${KEEP_WEEKLY}" \
    --keep-monthly "${KEEP_MONTHLY}"
}

# Signale l'état d'une exécution au témoin d'inactivité.
#
# Le témoin détecte le seul mode de panne que rien d'autre ne voit : la
# sauvegarde qui ne tourne plus du tout. Un `OnFailure` systemd ne se déclenche
# que si l'unité s'exécute ; si le timer est masqué ou la machine éteinte,
# personne n'est prévenu. L'absence de ping, elle, se remarque.
heartbeat() {
  local status="$1" # "start", "success" ou "fail"
  [ -n "${BACKUP_HEARTBEAT_URL:-}" ] || return 0

  local url="$BACKUP_HEARTBEAT_URL"
  case "$status" in
    start) url="$url/start" ;;
    fail) url="$url/fail" ;;
    success) ;;
    *) die "état de témoin inconnu : $status" ;;
  esac

  # Le témoin ne doit jamais faire échouer une sauvegarde réussie : une panne du
  # service tiers se signale dans le journal et s'arrête là.
  if ! curl --silent --show-error --max-time 10 --retry 3 --fail -o /dev/null "$url"; then
    log "témoin d'inactivité injoignable ($status) — sauvegarde non affectée"
  fi
}
