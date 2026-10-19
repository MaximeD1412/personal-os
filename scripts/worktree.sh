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

# Hôte et port du Postgres des tests, lus dans la même URL que postgres_accepte :
# un autre projet peut occuper 5432, et .env déplace alors celui-ci
# (POSTGRES_PORT et les URL).
adresse_postgres() {
  node -e '
    require("dotenv").config({ quiet: true });
    const url = new URL(
      process.env.TEST_DATABASE_URL ??
        process.env.DATABASE_URL ??
        "postgresql://personalos:personalos@localhost:5432/postgres",
    );
    console.log(`${url.hostname}:${url.port || 5432}`);
  '
}

port_ouvert() {
  (exec 3<>"/dev/tcp/${adresse%:*}/${adresse##*:}") 2>/dev/null
}

# Vrai si le Postgres des tests accepte les identifiants de .env : même URL que
# packages/api/test/global-setup.ts, sur la base d'administration. Vérifier le
# port ne suffit pas : un autre projet peut l'occuper. Code 1 : Postgres a
# répondu par un refus (son erreur porte un SQLSTATE). Code 2 : la connexion a
# échoué avant toute réponse (port fermé, coupure, délai dépassé).
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
        process.exit(/^[0-9A-Z]{5}$/.test(erreur.code ?? "") ? 1 : 2);
      },
    );
  '
}

# attendre_postgres <secondes>
attendre_postgres() {
  for _ in $(seq 1 "$1"); do
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
    adresse=$(adresse_postgres)
    etat=0
    refus=$(postgres_accepte 2>&1) || etat=$?
    if ((etat == 0)); then
      echo "ok   Postgres accepte la connexion sur $adresse"
    elif ((etat == 1)); then
      fail "un Postgres répond sur $adresse mais refuse la connexion avec les identifiants de .env ($refus). Le port est sans doute pris par un autre projet (docker ps --filter publish=${adresse##*:}) : déplace celui-ci avec POSTGRES_PORT et les URL de .env"
    elif port_ouvert; then
      # Le port accepte la connexion mais la coupe avant que Postgres réponde :
      # un Postgres qui démarre, ou le renvoi de port de Docker Desktop cassé
      # (vu après un redémarrage de WSL), que seul un redémarrage du conteneur
      # répare. Il ne coupe rien : plus personne n'atteint la base par ce port.
      echo "...  connexion coupée sur $adresse ($refus), nouvel essai"
      if ! attendre_postgres 15; then
        echo "...  toujours coupée après 15 s, redémarrage du conteneur db"
        step "docker compose restart db" docker compose -f "$main/docker-compose.yml" restart db
        attendre_postgres 60 || fail "Postgres coupe toujours la connexion sur $adresse après le redémarrage du conteneur db : redémarre Docker Desktop"
      fi
      echo "ok   Postgres accepte la connexion sur $adresse"
    else
      echo "...  Postgres ne répond pas sur $adresse, lancement de pnpm db:up"
      step "pnpm db:up (docker est-il lancé ?)" pnpm --dir "$main" db:up
      attendre_postgres 60 || fail "Postgres refuse toujours la connexion sur $adresse après 60 s"
      echo "ok   Postgres accepte la connexion sur $adresse"
    fi
    ;;
  drop)
    # Rien à détruire côté base : les tests suppriment leur base jetable.
    # Le démon Nx du worktree, lancé par la première commande nx, survit à
    # l'agent : arrêté ici, sinon il plante pendant `git worktree remove`
    # (node_modules effacé sous lui) et réécrit .nx/workspace-data, ce qui
    # laisse le dossier du worktree sur le disque.
    env -u NODE_ENV pnpm exec nx daemon --stop >/dev/null 2>&1 || true
    echo "ok   démon Nx arrêté"
    step "suppression de dist/ et .nx/cache" rm -rf "$root/dist" "$root/.nx/cache"
    echo "ok   dist/ et .nx/cache supprimés"
    echo "Pour retirer le worktree, depuis le dépôt principal :"
    echo "  git -C $(printf '%q' "$main") worktree remove $(printf '%q' "$root")"
    ;;
esac
