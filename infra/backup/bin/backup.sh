#!/usr/bin/env bash
#
# Sauvegarde Personal OS vers le dépôt Restic distant.
#
#   backup.sh [--dry-run]
#
# --dry-run n'écrit rien et n'ouvre aucune connexion : il imprime le plan, une
# étape par ligne préfixée « plan: ». C'est ce que les tests exercent, et c'est
# aussi la façon de vérifier une configuration avant de la laisser tourner sans
# surveillance.
#
# Voir docs/adr/0020-sauvegardes-restic-chez-un-autre-fournisseur.md
set -euo pipefail

LOG_TAG=sauvegarde
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/common.sh
. "$SCRIPT_DIR/../lib/common.sh"

DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      sed -n '2,14p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) die "argument inconnu : $1" ;;
  esac
  shift
done

plan() { printf 'plan: %s\n' "$*"; }

load_config
assert_password_file

# Le dump part dans un répertoire de transit, à côté des fichiers de
# configuration, pour que l'ensemble forme **un seul instantané**. Deux
# instantanés séparés se restaureraient à des dates différentes, et plus rien ne
# garantirait que la configuration corresponde aux données.
STAGING=""
cleanup() {
  local code=$?
  # Le dump contient l'intégralité des données personnelles en clair. Il
  # disparaît quoi qu'il arrive — succès, échec, ou interruption.
  [ -n "$STAGING" ] && rm -rf -- "$STAGING"
  return $code
}
trap cleanup EXIT

load_database_list

# `-Z0` : pas de compression côté PostgreSQL. Un dump compressé change
# intégralement à chaque octet modifié, ce qui annule la déduplication de Restic
# et fait grossir le dépôt d'un dump complet par jour. Restic compresse
# lui-même, après avoir dédupliqué.
pg_dump_cmd() {
  printf '%s\n' docker exec -i "$POSTGRES_CONTAINER" \
    pg_dump -U "$POSTGRES_USER" -d "$1" --format=custom -Z0
}

# Chaque base a son dump, sous son propre nom. restore.sh retrouve celui de
# l'application par ce chemin : le nommer d'après la base est ce qui permet
# d'en ajouter d'autres sans rien changer au banc d'essai de migration.
dump_relative() {
  printf 'postgres/%s.dump\n' "$1"
}

RESTIC_BACKUP_ARGS=(backup --tag personal-os --tag "hôte=$(hostname)")

if [ "$DRY_RUN" = 1 ]; then
  plan "dépôt ${RESTIC_REPOSITORY}"
  plan "clé lue dans ${RESTIC_PASSWORD_FILE}"
  for base in "${POSTGRES_DATABASE_LIST[@]}"; do
    mapfile -t commande < <(pg_dump_cmd "$base")
    plan "dump ${commande[*]} -> <transit>/$(dump_relative "$base")"
  done
  for path in ${BACKUP_PATHS:-}; do
    plan "inclut ${path}"
  done
  plan "restic ${RESTIC_BACKUP_ARGS[*]} <transit> ${BACKUP_PATHS:-}"
  plan "restic forget $(retention_args | tr '\n' ' ')--prune"
  plan "restic check"
  plan "témoin ${BACKUP_HEARTBEAT_URL:-<aucun>}"
  exit 0
fi

heartbeat start
# À partir d'ici, toute sortie non nulle doit prévenir : sans ça, un échec
# n'apparaît que dans un journal que personne ne lit.
trap 'heartbeat fail; cleanup' EXIT

STAGING=$(mktemp -d)
chmod 700 "$STAGING"

for base in "${POSTGRES_DATABASE_LIST[@]}"; do
  relative=$(dump_relative "$base")
  mkdir -p "$STAGING/$(dirname "$relative")"

  log "dump de $base depuis $POSTGRES_CONTAINER"
  mapfile -t commande < <(pg_dump_cmd "$base")
  "${commande[@]}" >"$STAGING/$relative"

  # Un pg_dump qui échoue à mi-parcours laisse un fichier tronqué et rend 0
  # dans certaines configurations de tube. Le format custom se vérifie : si
  # `pg_restore --list` ne sait pas le lire, il n'est pas restaurable, et le
  # sauvegarder reviendrait à archiver une illusion.
  log "vérification de la lisibilité du dump de $base"
  docker exec -i "$POSTGRES_CONTAINER" pg_restore --list >/dev/null <"$STAGING/$relative" ||
    die "dump de $base illisible par pg_restore — sauvegarde interrompue"
done

log "envoi vers $RESTIC_REPOSITORY"
# shellcheck disable=SC2086 # BACKUP_PATHS est une liste de chemins, à découper
restic "${RESTIC_BACKUP_ARGS[@]}" "$STAGING" ${BACKUP_PATHS:-}

log "application de la rétention"
mapfile -t keep_args < <(retention_args)
restic forget "${keep_args[@]}" --prune

# Vérification structurelle seulement : elle ne relit pas les données, donc elle
# ne coûte ni temps ni trafic sortant. La relecture complète (`--read-data`)
# appartient à la restauration de vérification, pas au chemin quotidien.
log "vérification du dépôt"
restic check

trap cleanup EXIT
heartbeat success
log "sauvegarde terminée"
