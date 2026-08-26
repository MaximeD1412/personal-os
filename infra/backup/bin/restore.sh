#!/usr/bin/env bash
#
# Restaure un instantané Restic dans une cible jetable.
#
#   restore.sh --target DIR [--snapshot ID] [--into-postgres] [--database NOM]
#              [--read-data] [--keep] [--dry-run]
#
#   --snapshot       instantané à restaurer (défaut : latest)
#   --into-postgres  remonte le dump dans un conteneur PostgreSQL jetable et
#                    imprime « dsn: <url> » sur la sortie standard
#   --database       base à remonter (défaut : POSTGRES_DB, celle de
#                    l'application). Authentik a la sienne.
#   --read-data      relit tous les paquets du dépôt avant de restaurer
#   --keep           laisse le conteneur jetable en vie (le banc d'essai de
#                    migration en a besoin ; sinon il est détruit à la sortie)
#   --dry-run        imprime le plan, n'exécute rien
#
# Ce script est le banc d'essai de migration de l'ADR 0021 : il est appelé par
# le déploiement (#4) avant toute migration réelle. Son interface est donc un
# contrat — « dsn: » sur la sortie standard, tout le reste sur l'erreur standard.
#
# Il ne restaure JAMAIS vers la production. Voir assert_disposable ci-dessous.
set -euo pipefail

LOG_TAG=restauration
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/common.sh
. "$SCRIPT_DIR/../lib/common.sh"

SNAPSHOT=latest
TARGET=""
DATABASE=""
INTO_POSTGRES=0
READ_DATA=0
KEEP=0
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --snapshot)
      SNAPSHOT="${2:-}"
      shift
      ;;
    --target)
      TARGET="${2:-}"
      shift
      ;;
    --database)
      DATABASE="${2:-}"
      shift
      ;;
    --into-postgres) INTO_POSTGRES=1 ;;
    --read-data) READ_DATA=1 ;;
    --keep) KEEP=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      sed -n '2,22p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) die "argument inconnu : $1" ;;
  esac
  shift
done

[ -n "$TARGET" ] || die "--target est obligatoire"

plan() { printf 'plan: %s\n' "$*"; }

load_config
assert_password_file

load_database_list

# Par défaut, la base de l'application : c'est ce qu'attend le banc d'essai de
# migration, qui appelle ce script sans rien préciser.
DATABASE="${DATABASE:-$POSTGRES_DB}"

# La base demandée doit être dans l'instantané. Sans cette vérification,
# l'erreur n'apparaîtrait qu'après une restauration complète, sous la forme
# d'un « aucun dump » qui ne dirait pas pourquoi.
dans_la_sauvegarde() {
  local base
  for base in "${POSTGRES_DATABASE_LIST[@]}"; do
    [ "$base" = "$DATABASE" ] && return 0
  done
  return 1
}
dans_la_sauvegarde ||
  die "la base « $DATABASE » n'est pas sauvegardée (POSTGRES_DATABASES=$POSTGRES_DATABASES)"

DUMP_RELATIVE="postgres/${DATABASE}.dump"
PROBE_CONTAINER="personal-os-restore-$$"
PROBE_PORT="${RESTORE_PROBE_PORT:-55432}"

# Garde-fou central : une restauration ne touche jamais la production.
#
# C'est la seule protection contre la faute qui coûte tout — un banc d'essai de
# migration branché par erreur sur la base réelle écraserait les données qu'il
# est censé protéger. Elle est vérifiée avant le moindre effet de bord, y
# compris en --dry-run, pour qu'une configuration fautive se voie sans risque.
assert_disposable() {
  [ "$PROBE_CONTAINER" != "$POSTGRES_CONTAINER" ] ||
    die "le conteneur de restauration porte le nom de la production ($POSTGRES_CONTAINER)"
  case "$TARGET" in
    /var/lib/postgresql* | /etc/personal-os*)
      die "cible de restauration interdite : $TARGET"
      ;;
  esac
}
assert_disposable

if [ "$DRY_RUN" = 1 ]; then
  plan "dépôt ${RESTIC_REPOSITORY}"
  [ "$READ_DATA" = 1 ] && plan "restic check --read-data"
  plan "restic restore ${SNAPSHOT} --target ${TARGET}"
  if [ "$INTO_POSTGRES" = 1 ]; then
    plan "conteneur jetable ${PROBE_CONTAINER} sur le port ${PROBE_PORT}"
    plan "pg_restore <- ${TARGET}/**/${DUMP_RELATIVE}"
    plan "dsn: postgresql://postgres:***@localhost:${PROBE_PORT}/${DATABASE}"
  fi
  exit 0
fi

PROBE_STARTED=0
cleanup() {
  local code=$?
  if [ "$PROBE_STARTED" = 1 ] && [ "$KEEP" != 1 ]; then
    docker rm --force "$PROBE_CONTAINER" >/dev/null 2>&1 || true
  fi
  return $code
}
trap cleanup EXIT

if [ "$READ_DATA" = 1 ]; then
  log "relecture complète du dépôt — peut être long"
  restic check --read-data
fi

log "restauration de l'instantané $SNAPSHOT vers $TARGET"
mkdir -p "$TARGET"
restic restore "$SNAPSHOT" --target "$TARGET"

if [ "$INTO_POSTGRES" != 1 ]; then
  log "restauration terminée"
  exit 0
fi

# Le dump est sous le chemin de transit d'origine, dont le nom est aléatoire :
# on le retrouve par sa position relative plutôt qu'en reconstruisant le chemin.
DUMP_PATH=$(find "$TARGET" -type f -path "*/$DUMP_RELATIVE" -print -quit)
[ -n "$DUMP_PATH" ] || die "aucun dump $DUMP_RELATIVE dans l'instantané restauré"

PROBE_PASSWORD=$(openssl rand -hex 16)
log "démarrage du conteneur jetable $PROBE_CONTAINER"
docker run --detach --rm \
  --name "$PROBE_CONTAINER" \
  --env POSTGRES_PASSWORD="$PROBE_PASSWORD" \
  --env POSTGRES_DB="$DATABASE" \
  --publish "127.0.0.1:${PROBE_PORT}:5432" \
  postgres:18-alpine >/dev/null
PROBE_STARTED=1

log "attente de disponibilité"
# Deux faux positifs se succèdent au démarrage de l'image PostgreSQL, et il faut
# les écarter tous les deux.
#
# `pg_isready` répond « prêt » avant que POSTGRES_DB existe. Mais interroger la
# base visée ne suffit pas non plus : l'initialisation crée cette base sur un
# serveur **temporaire**, qu'elle éteint ensuite pour lancer le vrai. Une
# requête peut donc aboutir juste avant l'extinction :
#
#     LOG:  database system is ready to accept connections   <- temporaire
#     LOG:  shutting down
#     PostgreSQL init process complete; ready for start up.
#     LOG:  database system is ready to accept connections   <- le vrai
#
# La commande suivante tombe alors sur « the database system is shutting down »,
# et la répétition de migration échoue pour une raison qui n'a rien à voir avec
# la migration — donc un déploiement sain est arrêté. On attend la marque de fin
# d'initialisation, *puis* la requête.
init_complete() {
  conteneur_initialise "$PROBE_CONTAINER"
}

probe_ready() {
  docker exec --env PGPASSWORD="$PROBE_PASSWORD" "$PROBE_CONTAINER" \
    psql --username postgres --dbname "$DATABASE" --command 'select 1' >/dev/null 2>&1
}

for _ in $(seq 1 60); do
  init_complete && break
  sleep 1
done
init_complete || die "le conteneur jetable n'a pas fini son initialisation"

for _ in $(seq 1 60); do
  probe_ready && break
  sleep 1
done
probe_ready || die "le conteneur jetable n'a pas démarré"

log "remontée du dump"
docker exec -i --env PGPASSWORD="$PROBE_PASSWORD" "$PROBE_CONTAINER" \
  pg_restore --username postgres --dbname "$DATABASE" --no-owner --exit-on-error \
  <"$DUMP_PATH"

# Une restauration qui rend la main ne prouve rien : elle prouve que des
# fichiers sont revenus, pas qu'ils sont exploitables. Le critère n'est tenu que
# si une requête répond sur la base restaurée.
TABLES=$(docker exec --env PGPASSWORD="$PROBE_PASSWORD" "$PROBE_CONTAINER" \
  psql --username postgres --dbname "$DATABASE" --tuples-only --no-align \
  --command "select count(*) from information_schema.tables where table_schema = 'public'")
[ "$TABLES" -gt 0 ] || die "base restaurée vide — la sauvegarde ne vaut rien"
log "base restaurée : $TABLES tables dans le schéma public"

printf 'dsn: postgresql://postgres:%s@localhost:%s/%s\n' \
  "$PROBE_PASSWORD" "$PROBE_PORT" "$DATABASE"

if [ "$KEEP" = 1 ]; then
  log "conteneur $PROBE_CONTAINER laissé en vie — à supprimer par l'appelant"
fi
