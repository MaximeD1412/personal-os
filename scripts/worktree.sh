#!/usr/bin/env bash
# Prépare et nettoie un worktree d'agent, frère du dépôt principal
# (../personal-os-feat-<n>-<slug>), pour la boucle et pick-issue.
#
#   scripts/worktree.sh setup   depuis le worktree, juste après `git worktree add`
#   scripts/worktree.sh drop    depuis le worktree, avant `git worktree remove`
#
# Pas de base par worktree : chaque exécution des tests d'intégration crée sa
# propre base jetable (packages/api/test/global-setup.ts), si bien que plusieurs
# worktrees testent en même temps sur le même Postgres. Jamais de lien vers les
# node_modules du dépôt principal : le store pnpm est partagé, l'installation
# est rapide.
set -euo pipefail

cmd=${1:-}
root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "ÉCHEC : à lancer dans un worktree du dépôt" >&2
  exit 1
}
main=$(dirname "$(git -C "$root" rev-parse --path-format=absolute --git-common-dir)")

fail() {
  echo "ÉCHEC : $*" >&2
  exit 1
}

# Lance une étape et, si elle échoue, sort avec son message. Sa sortie n'est
# affichée qu'en cas d'échec.
step() {
  local message=$1 out
  shift
  out=$("$@" 2>&1) || {
    echo "$out" >&2
    fail "$message"
  }
}

port_ouvert() {
  (exec 3<>/dev/tcp/localhost/5432) 2>/dev/null
}

# Vrai si le Postgres des tests accepte les identifiants de .env : même URL que
# packages/api/test/global-setup.ts, sur la base d'administration. Vérifier le
# port ne suffit pas : un autre projet peut l'occuper.
postgres_accepte() {
  node -e '
    require("dotenv").config({ quiet: true });
    const { Client } = require("pg");
    const url = new URL(
      process.env.TEST_DATABASE_URL ??
        process.env.DATABASE_URL ??
        "postgresql://personalos:personalos@localhost:5432/postgres",
    );
    url.pathname = "/postgres";
    url.search = "";
    const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 2000 });
    client.connect().then(
      () => client.end(),
      (erreur) => {
        console.error(erreur.message);
        process.exit(1);
      },
    );
  '
}

attendre_postgres() {
  for _ in $(seq 1 60); do
    postgres_accepte 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

[[ $cmd == setup || $cmd == drop ]] || fail "usage : scripts/worktree.sh setup|drop"
[[ $root != "$main" ]] || fail "à lancer dans un worktree, pas dans le dépôt principal ($main)"

cd "$root"

case $cmd in
  setup)
    # 1. Les .env* non suivis du dépôt principal, sans écraser ceux du worktree.
    while IFS= read -r src; do
      rel=${src#"$main"/}
      git -C "$main" ls-files --error-unmatch -- "$rel" >/dev/null 2>&1 && continue
      if [[ -e $root/$rel ]]; then
        echo "ok   $rel déjà présent, laissé tel quel"
        continue
      fi
      mkdir -p "$(dirname "$root/$rel")"
      step "copie de $rel depuis le dépôt principal" cp "$src" "$root/$rel"
      echo "ok   $rel copié depuis le dépôt principal"
    done < <(find "$main" -maxdepth 4 \
      \( -name node_modules -o -name .git -o -name .pnpm-store -o -name dist -o -name .nx \) -prune \
      -o -type f -name '.env*' -print)

    # 2. Dépendances. NODE_ENV retiré : certains shells exportent
    # NODE_ENV=production, et pnpm sauterait alors les devDependencies.
    step "pnpm install" env -u NODE_ENV pnpm install --frozen-lockfile --prefer-offline
    echo "ok   dépendances installées"

    # 3. Client Prisma (déjà lancé par le postinstall, rejoué au cas où il a été
    # sauté).
    step "pnpm prisma:generate" env PRISMA_HIDE_UPDATE_MESSAGE=1 pnpm prisma:generate
    echo "ok   client Prisma généré"

    # 4. Postgres partagé par tous les worktrees : celui du dépôt principal.
    # `db:up` est lancé depuis le dépôt principal pour garder le même projet
    # compose, donc le même conteneur et le même volume.
    if refus=$(postgres_accepte 2>&1); then
      echo "ok   Postgres accepte la connexion sur localhost:5432"
    elif port_ouvert; then
      fail "un Postgres répond sur localhost:5432 mais refuse les identifiants de .env ($refus). Le port est sans doute pris par un autre projet : docker ps --filter publish=5432"
    else
      echo "...  Postgres ne répond pas sur localhost:5432, lancement de pnpm db:up"
      step "pnpm db:up (docker est-il lancé ?)" pnpm --dir "$main" db:up
      attendre_postgres || fail "Postgres refuse toujours la connexion sur localhost:5432 après 60 s"
      echo "ok   Postgres accepte la connexion sur localhost:5432"
    fi
    ;;
  drop)
    # Rien à détruire côté base : les tests suppriment leur base jetable.
    step "suppression de dist/ et .nx/cache" rm -rf "$root/dist" "$root/.nx/cache"
    echo "ok   dist/ et .nx/cache supprimés"
    echo "Pour retirer le worktree, depuis le dépôt principal :"
    echo "  git -C $(printf '%q' "$main") worktree remove $(printf '%q' "$root")"
    ;;
esac
