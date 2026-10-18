#!/usr/bin/env bash
# Provisionnement de la machine (INFRA-11) : Debian 12+ ou Ubuntu 22.04+, x86
# ou ARM, n'importe quel hébergeur. Idempotent : relancé, il remet la machine
# dans l'état attendu et ne change rien à ce qui l'est déjà.
#
#   sudo ./provision.sh [--admin-user ops] [--ssh-key "ssh-ed25519 AAAA… moi@poste"]…
#   sudo ./provision.sh --dry-run      # ce qui changerait, sans rien appliquer
#
# SSH par clé uniquement et root refusé, fail2ban, pare-feu (22, 80, 443) dont
# les ports publiés par Docker ne passent pas outre, mises à jour de sécurité
# automatiques, Docker et Compose, utilisateur d'administration.
# Mode d'emploi : infra/provision/README.md.
#
# --root DIR écrit sous DIR et journalise les commandes système dans
# DIR/.commands au lieu de les lancer (tests : src/provision.*.spec.ts).
set -euo pipefail

ADMIN_USER=ops
ROOT=/
DRY_RUN=false
EXTRA_KEYS=()
CHANGES=()
# Seuls ports joignables de dehors, sur l'hôte comme par Docker.
OPEN_PORTS=(22/tcp 80/tcp 443/tcp 443/udp)
DOCKER_OPEN_PORTS=(80/tcp 443/tcp 443/udp)
BASE_PACKAGES=(ca-certificates curl jq sudo openssh-server ufw fail2ban python3-systemd unattended-upgrades)
DOCKER_PACKAGES=(docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin)
KEY_LINE='^(ssh-|ecdsa-|sk-)[A-Za-z0-9@.-]+ [A-Za-z0-9+/]+=*( .*)?$'
export DEBIAN_FRONTEND=noninteractive

die() {
  echo "provision: $*" >&2
  exit 1
}

warn() {
  echo "provision: $*" >&2
}

# Une machine que le script ne sait pas mettre dans l'état attendu est refusée
# avant la moindre modification. En --dry-run, le refus est annoncé et le plan
# affiché quand même ; le code de sortie est alors 1.
REFUSED=false
refuse() {
  if $DRY_RUN; then
    warn "le passage réel refusera : $*"
    REFUSED=true
  else
    die "$*"
  fi
}

usage() {
  sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

changed() {
  CHANGES+=("$1")
}

# Lance une commande système ; l'annonce en --dry-run ; la journalise sous une
# racine de test.
run() {
  if $DRY_RUN; then
    echo "  à lancer : $*"
  elif [[ "$ROOT" != / ]]; then
    echo "$*" >>"$ROOT/.commands"
  else
    "$@"
  fi
}

# Pose stdin dans un fichier de la machine s'il diffère, contenu ou droits.
# Rend 0 si le fichier a changé (ou changerait, en --dry-run), 1 sinon.
write_file() {
  local rel="$1" mode="$2" path="$ROOT/$1" new
  new=$(mktemp)
  cat >"$new"
  if [[ -f "$path" ]] && cmp -s "$new" "$path" && [[ "$(stat -c %a "$path")" == "$mode" ]]; then
    rm -f "$new"
    return 1
  fi
  changed "/$rel"
  if $DRY_RUN; then
    diff -u --label "/$rel" --label "/$rel (attendu)" "$([[ -f "$path" ]] && echo "$path" || echo /dev/null)" "$new" || true
    rm -f "$new"
    return 0
  fi
  mkdir -p "$(dirname "$path")"
  cat "$new" >"$path.provision"
  rm -f "$new"
  chmod "$mode" "$path.provision"
  mv -f "$path.provision" "$path"
}

# Rend 0 si le dossier a été créé ou ses droits corrigés.
ensure_dir() {
  local rel="$1" mode="$2" path="$ROOT/$1"
  [[ -d "$path" && "$(stat -c %a "$path")" == "$mode" ]] && return 1
  changed "/$rel/"
  $DRY_RUN && return 0
  mkdir -p "$path"
  chmod "$mode" "$path"
}

# Les sondes lisent les fichiers de la machine plutôt que d'interroger les
# outils : elles marchent pareil sous une racine de test.
package_installed() {
  awk -v p="$1" '
    /^Package: / { name = $2 }
    /^Status: / && name == p && $0 ~ /install ok installed/ { found = 1 }
    END { exit !found }' "$ROOT/var/lib/dpkg/status" 2>/dev/null
}

user_exists() {
  grep -q "^$1:" "$ROOT/etc/passwd" 2>/dev/null
}

in_group() {
  awk -F: -v g="$1" -v u="$2" '$1 == g { n = split($4, m, ","); for (i = 1; i <= n; i++) if (m[i] == u) found = 1 } END { exit !found }' \
    "$ROOT/etc/group" 2>/dev/null
}

service_enabled() {
  [[ -e "$ROOT/etc/systemd/system/multi-user.target.wants/$1.service" ]]
}

# Seule sonde qui interroge systemd : un service activé n'est pas forcément
# démarré (installé sous une politique qui interdit les démarrages, ou tombé).
# Sous une racine de test, activé vaut démarré.
service_active() {
  if [[ "$ROOT" == / ]]; then
    systemctl is-active --quiet "$1"
  else
    service_enabled "$1"
  fi
}

# Rend 0 si le service vient d'être activé ou démarré.
ensure_service() {
  service_enabled "$1" && service_active "$1" && return 1
  changed "$1 activé et démarré"
  run systemctl enable --now "$1"
}

compose_installed() {
  local dir
  for dir in usr/libexec/docker/cli-plugins usr/lib/docker/cli-plugins usr/local/lib/docker/cli-plugins usr/local/libexec/docker/cli-plugins; do
    [[ -e "$ROOT/$dir/docker-compose" ]] && return 0
  done
  return 1
}

# --- Vérifications : tout est contrôlé avant la moindre modification. ---

OS_ID=""
OS_CODENAME=""
ARCH=""
ADMIN_KEYS=""

check_os() {
  local id version
  [[ -f "$ROOT/etc/os-release" ]] || die "/etc/os-release absent : système non reconnu (Debian 12+ ou Ubuntu 22.04+)"
  # shellcheck source=/dev/null
  id=$(. "$ROOT/etc/os-release" && echo "${ID:-}")
  # shellcheck source=/dev/null
  version=$(. "$ROOT/etc/os-release" && echo "${VERSION_ID:-}")
  # shellcheck source=/dev/null
  OS_CODENAME=$(. "$ROOT/etc/os-release" && echo "${VERSION_CODENAME:-}")
  local major="${version%%.*}" minor=0
  [[ "$version" == *.* ]] && minor="${version#*.}"
  [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]] || major=0
  case "$id" in
    debian) ((major >= 12)) || die "système non pris en charge : $id $version (Debian 12+ ou Ubuntu 22.04+)" ;;
    ubuntu) ((major * 100 + 10#$minor >= 2204)) || die "système non pris en charge : $id $version (Debian 12+ ou Ubuntu 22.04+)" ;;
    *) die "système non pris en charge : ${id:-inconnu} (Debian 12+ ou Ubuntu 22.04+)" ;;
  esac
  [[ -n "$OS_CODENAME" ]] || die "VERSION_CODENAME absent de /etc/os-release"
  OS_ID="$id"
}

check_arch() {
  case "$(uname -m)" in
    x86_64) ARCH=amd64 ;;
    aarch64 | arm64) ARCH=arm64 ;;
    *) die "architecture non prise en charge : $(uname -m) (x86 ou ARM)" ;;
  esac
}

# La configuration posée dans sshd_config.d ne vaut que si le fichier
# principal l'inclut (Debian 12 et Ubuntu 22.04 le font, en tête).
check_sshd_include() {
  grep -Eq '^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\.d/\*\.conf' "$ROOT/etc/ssh/sshd_config" 2>/dev/null ||
    die "/etc/ssh/sshd_config n'inclut pas /etc/ssh/sshd_config.d/*.conf : le durcissement serait sans effet"
}

# sshd garde la première valeur lue. Une directive de durcissement contraire,
# lue avant 00-personal-os.conf (dans sshd_config avant l'Include, ou dans un
# fichier de sshd_config.d trié avant le nôtre), l'emporterait. Dans un bloc
# Match, où qu'il soit, elle remplacerait la valeur globale pour les connexions
# qu'il désigne (« Match User root » puis « PermitRootLogin yes »). Tout autre
# Include que celui de sshd_config.d/*.conf est refusé : le fichier inclus ne
# serait pas contrôlé. La machine est refusée, à chaque passage, avant toute
# modification.
check_sshd_precedence() {
  local lus=() file conflicts LC_ALL=C
  lus+=("$ROOT/etc/ssh/sshd_config")
  while IFS= read -r file; do
    [[ -n "$file" && "$(basename "$file")" != 00-personal-os.conf ]] && lus+=("$file")
  done < <(compgen -G "$ROOT/etc/ssh/sshd_config.d/*.conf" | sort)
  conflicts=$(awk '
    BEGIN {
      want["permitrootlogin"] = "no"; want["passwordauthentication"] = "no"
      want["kbdinteractiveauthentication"] = "no"; want["challengeresponseauthentication"] = "no"
      want["pubkeyauthentication"] = "yes"; want["authenticationmethods"] = "publickey"
    }
    FNR == 1 {
      name = FILENAME; sub(/.*\//, "", name)
      main = (name == "sshd_config"); inmatch = 0
      # Lu avant le nôtre : sshd_config jusqu à l Include, et les fichiers
      # triés avant 00-personal-os.conf.
      before = main || name < "00-personal-os.conf"
    }
    /^[[:space:]]*(#|$)/ { next }
    # Comme OpenSSH : le mot-clé se sépare de sa valeur par des blancs ou par
    # un « = » (PermitRootLogin=yes) ; la valeur peut être entre guillemets.
    {
      line = $0; sub(/^[ \t]+/, "", line)
      key = line; sub(/[ \t=].*/, "", key)
      val = substr(line, length(key) + 1); key = tolower(key)
      sub(/^[ \t]*=?[ \t]*/, "", val); sub(/[ \t]+#.*$/, "", val); sub(/[ \t]+$/, "", val)
      gsub(/"/, "", val); gsub(/[ \t]+/, " ", val)
      # Les chemins gardent leur casse (OpenSSH les passe tels quels à glob) ;
      # seules les valeurs des directives se comparent sans casse.
      path = val; val = tolower(val)
    }
    # Seul l Include standard de Debian et Ubuntu est suivi : un autre fichier
    # inclus (ailleurs, ou depuis sshd_config.d) échapperait au contrôle.
    key == "include" && main && path == "/etc/ssh/sshd_config.d/*.conf" { before = 0; next }
    key == "include" { print FILENAME ": " $0 " (Include non pris en charge)"; next }
    key == "match" { inmatch = 1; next }
    (before || inmatch) && key in want && val != want[key] {
      print FILENAME ": " $0 (inmatch ? " (bloc Match)" : "")
    }
  ' "${lus[@]}")
  [[ -z "$conflicts" ]] ||
    die "$(printf 'directives sshd qui annuleraient le durcissement (lues avant 00-personal-os.conf, dans un bloc Match, ou dans un fichier inclus non contrôlé) :\n%s\nLes retirer, puis relancer' "${conflicts//"$ROOT"\//\/}")"
}

# Clés de l'administrateur : les siennes, gardées telles quelles, puis celles du
# compte qui lance sudo, de root et de --ssh-key. Une clé à options (bridée par
# command=, from=…) n'est jamais recopiée : sans ses options, elle donnerait
# plus qu'on ne lui avait donné.
collect_keys() {
  local sources=() file
  [[ -n "${SUDO_USER:-}" && "$SUDO_USER" != root ]] && sources+=("home/$SUDO_USER/.ssh/authorized_keys")
  sources+=(root/.ssh/authorized_keys)
  ADMIN_KEYS=$(
    {
      grep -v '^[[:space:]]*$' "$ROOT/home/$ADMIN_USER/.ssh/authorized_keys" 2>/dev/null || true
      for file in "${sources[@]}"; do
        grep -E "$KEY_LINE" "$ROOT/$file" 2>/dev/null || true
      done
      ((${#EXTRA_KEYS[@]} == 0)) || printf '%s\n' "${EXTRA_KEYS[@]}"
    } | awk '!seen[$0]++'
  )
  [[ -n "$ADMIN_KEYS" ]] ||
    die "aucune clé SSH trouvée (ni pour root, ni pour ${SUDO_USER:-le compte sudo}, ni par --ssh-key) : on se couperait l'accès"
}

# Docker déjà installé sans Compose, hors du dépôt officiel (docker.io) : le
# script ne sait pas lui ajouter un Compose compatible, et le déploiement en a
# besoin.
check_compose() {
  [[ -e "$ROOT/usr/bin/docker" ]] || return 0
  compose_installed || package_installed docker-ce ||
    refuse "Docker est installé sans Compose, hors du dépôt officiel (docker.io ?) : installer Docker CE (download.docker.com) ou Compose, puis relancer"
}

# La chaîne DOCKER-USER n'est raccordée par Docker qu'avec son pare-feu
# iptables. Avec le backend nftables, ou iptables désactivé, les règles posées
# plus bas seraient sans effet et les ports publiés passeraient outre.
check_docker_firewall() {
  local path="$ROOT/etc/docker/daemon.json"
  [[ -f "$path" ]] || return 0
  if grep -Eq '"firewall-backend"[[:space:]]*:[[:space:]]*"nftables"' "$path"; then
    refuse "/etc/docker/daemon.json : firewall-backend nftables, Docker ne passerait pas par DOCKER-USER. Retirer l'option (backend iptables), redémarrer Docker, puis relancer"
  fi
  if grep -Eq '"iptables"[[:space:]]*:[[:space:]]*false' "$path"; then
    refuse "/etc/docker/daemon.json : iptables désactivé, Docker ne passerait pas par DOCKER-USER. Retirer l'option, redémarrer Docker, puis relancer"
  fi
  return 0
}

# --- Configuration ---

install_packages() {
  local missing=() pkg
  for pkg in "$@"; do
    package_installed "$pkg" || missing+=("$pkg")
  done
  ((${#missing[@]} > 0)) || return 0
  changed "paquets installés : ${missing[*]}"
  run apt-get update
  run apt-get install -y --no-install-recommends "${missing[@]}"
}

write_fail2ban_jail() {
  write_file etc/fail2ban/jail.d/personal-os.local 644 <<'EOF'
# Géré par infra/provision/provision.sh (INFRA-11) : ne pas modifier à la main.
[sshd]
enabled = true
backend = systemd
# Le filtre livré ne lit que sshd.service et le processus sshd : l'unité
# s'appelle ssh.service sur Debian et Ubuntu, et OpenSSH 9.8+ authentifie
# dans sshd-session.
journalmatch = _SYSTEMD_UNIT=ssh.service + _SYSTEMD_UNIT=sshd.service + _COMM=sshd + _COMM=sshd-session
maxretry = 5
findtime = 10m
bantime = 1h
EOF
}

# Mises à jour de sécurité quotidiennes (les origines de sécurité sont celles
# de la configuration par défaut, Debian comme Ubuntu). Redémarrage à 05:00
# seulement quand une mise à jour l'exige (noyau), après la sauvegarde de
# 03:30 ; les conteneurs repartent seuls (restart: unless-stopped).
write_auto_upgrades() {
  write_file etc/apt/apt.conf.d/20auto-upgrades 644 <<'EOF' || true
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
  write_file etc/apt/apt.conf.d/52personal-os-unattended-upgrades 644 <<'EOF' || true
// Géré par infra/provision/provision.sh (INFRA-11).
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "05:00";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
}

# Pas de mot de passe : sudo sans mot de passe, accès par clé seulement.
configure_admin() {
  local home="home/$ADMIN_USER" touched=false
  if ! user_exists "$ADMIN_USER"; then
    changed "compte $ADMIN_USER créé"
    run useradd --create-home --shell /bin/bash "$ADMIN_USER"
  fi
  ensure_dir "$home/.ssh" 700 && touched=true
  write_file "$home/.ssh/authorized_keys" 600 <<<"$ADMIN_KEYS" && touched=true
  if $touched; then
    run chown -R "$ADMIN_USER:$ADMIN_USER" "/$home/.ssh"
  fi
  write_file "etc/sudoers.d/90-$ADMIN_USER" 440 <<<"$ADMIN_USER ALL=(ALL) NOPASSWD:ALL" || true
}

# Préfixe 00 : sshd garde la première valeur lue, avant celles de l'hébergeur
# (50-cloud-init.conf réactive parfois les mots de passe).
configure_ssh() {
  if write_file etc/ssh/sshd_config.d/00-personal-os.conf 644 <<'EOF'; then
# Géré par infra/provision/provision.sh (INFRA-11) : ne pas modifier à la main.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3
LoginGraceTime 20
X11Forwarding no
EOF
    run mkdir -p /run/sshd
    run sshd -t
    run systemctl try-reload-or-restart ssh
  fi
  # À chaque passage réel, même sans changement : le fichier peut être en
  # place sans avoir d'effet.
  if [[ "$ROOT" == / ]] && ! $DRY_RUN; then
    # Lue en entier : `sshd -T | grep -q` échoue sous pipefail quand grep
    # ferme le tube avant la fin (SIGPIPE).
    # -C : la configuration d'une connexion donnée, blocs Match compris.
    local effective who
    for who in root "$ADMIN_USER"; do
      effective=$(sshd -T -C "user=$who,host=localhost,addr=127.0.0.1")
      grep -qx 'passwordauthentication no' <<<"$effective" || die "sshd accepte encore les mots de passe pour $who : une autre configuration l'emporte"
      grep -qx 'permitrootlogin no' <<<"$effective" || die "sshd accepte encore root (connexion de $who) : une autre configuration l'emporte"
    done
  fi
}

configure_fail2ban() {
  local jail_changed="$1"
  if ! ensure_service fail2ban && $jail_changed; then
    run systemctl restart fail2ban
  fi
}

# Journaux bornés et live-restore, fusionnés avec la configuration existante.
# Rend 0 si daemon.json a changé.
write_docker_daemon() {
  local path="$ROOT/etc/docker/daemon.json" before='{}'
  local wanted='{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" }, "live-restore": true }'
  if ! command -v jq >/dev/null; then
    # Seulement en --dry-run : jq est installé avec les paquets de base.
    changed "/etc/docker/daemon.json (jq absent : fusion non calculée)"
    return 0
  fi
  local merged
  [[ -s "$path" ]] && before=$(cat "$path")
  merged=$(jq -s '.[0] * .[1]' <(echo "$before") - <<<"$wanted") || die "/etc/docker/daemon.json illisible : JSON invalide"
  write_file etc/docker/daemon.json 644 <<<"$merged"
}

# Docker CE depuis le dépôt officiel (docker.io est trop ancien sur Debian).
# Une installation existante est gardée ; sa configuration se recharge à chaud :
# redémarrer dockerd couperait les conteneurs de tous les projets de la
# machine. live-restore s'applique tout de suite, les journaux bornés au
# prochain démarrage du démon.
configure_docker() {
  local daemon_changed=false
  write_docker_daemon && daemon_changed=true
  if [[ ! -e "$ROOT/usr/bin/docker" ]]; then
    changed "Docker installé depuis download.docker.com"
    run install -m 0755 -d /etc/apt/keyrings
    run curl -fsSL "https://download.docker.com/linux/$OS_ID/gpg" -o /etc/apt/keyrings/docker.asc
    write_file etc/apt/sources.list.d/docker.list 644 \
      <<<"deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$OS_ID $OS_CODENAME stable" || true
    run apt-get update
    run apt-get install -y "${DOCKER_PACKAGES[@]}"
  else
    # Hors du dépôt officiel, check_compose a déjà refusé la machine.
    if ! compose_installed; then
      changed "Docker Compose installé"
      run apt-get install -y docker-compose-plugin
    fi
    # Arrêté, il lira sa configuration en démarrant (ensure_service, plus
    # bas) : un reload échouerait.
    if $daemon_changed; then
      run dockerd --validate --config-file /etc/docker/daemon.json
      if service_active docker; then
        run systemctl reload docker
      fi
    fi
  fi
  ensure_service docker || true
  if ! in_group docker "$ADMIN_USER"; then
    changed "$ADMIN_USER ajouté au groupe docker"
    run usermod -aG docker "$ADMIN_USER"
  fi
}

# Remplace (ou ajoute) le bloc balisé de ce script dans un fichier, en gardant
# le reste. Rend 0 si le fichier a changé.
replace_block() {
  local rel="$1" begin="# BEGIN PERSONAL-OS $2" end="# END PERSONAL-OS $2" path="$ROOT/$1" kept=""
  local block
  block=$(cat)
  [[ -f "$path" ]] && kept=$(awk -v b="$begin" -v e="$end" '$0 == b { skip = 1 } !skip { print } $0 == e { skip = 0 }' "$path")
  write_file "$rel" 640 < <(
    [[ -z "$kept" ]] || printf '%s\n' "$kept"
    printf '%s\n%s\n%s\n' "$begin" "$block" "$end"
  )
}

# Docker publie ses ports par DNAT, avant les règles d'entrée d'ufw : sans ce
# bloc, un `ports: "5432:5432"` serait ouvert sur Internet. Une connexion venue
# de dehors vers un port publié ne passe que si elle visait 80 ou 443 côté hôte
# (--ctorigdstport : le port d'origine, avant la traduction vers le conteneur).
# Les réseaux Docker entre eux, et les réponses, passent.
docker_user_rules() {
  local spec
  echo '*filter'
  echo ':DOCKER-USER - [0:0]'
  echo '-A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN'
  echo '-A DOCKER-USER -i docker0 -j RETURN'
  echo '-A DOCKER-USER -i br-+ -j RETURN'
  for spec in "${DOCKER_OPEN_PORTS[@]}"; do
    echo "-A DOCKER-USER -p ${spec#*/} -m conntrack --ctorigdstport ${spec%/*} --ctdir ORIGINAL -j RETURN"
  done
  echo '-A DOCKER-USER -j DROP'
  echo 'COMMIT'
}

ufw_enabled() {
  grep -qx 'ENABLED=yes' "$ROOT/etc/ufw/ufw.conf" 2>/dev/null
}

ufw_rule() {
  echo "### tuple ### allow ${1#*/} ${1%/*} 0.0.0.0/0 any 0.0.0.0/0 in"
}

ufw_has_rule() {
  grep -qxF "$(ufw_rule "$1")" "$ROOT/etc/ufw/user.rules" 2>/dev/null
}

# Une autorisation ufw hors de 22, 80 et 443 ouvre un port public, et en IPv6
# elle ouvre aussi un port publié par Docker : docker-proxy le reçoit par
# INPUT, où DOCKER-USER ne s'applique pas. La machine est partagée : une telle
# règle n'est pas retirée en silence, elle fait refuser le passage, avant toute
# modification, jusqu'à ce qu'on la retire à la main.
check_foreign_rules() {
  local expected foreign
  expected=$(for spec in "${OPEN_PORTS[@]}"; do
    ufw_rule "$spec"
    ufw_rule "$spec" | sed 's|0\.0\.0\.0/0|::/0|g'
  done)
  foreign=$(
    { cat "$ROOT/etc/ufw/user.rules" "$ROOT/etc/ufw/user6.rules" 2>/dev/null || true; } |
      { grep -E '^### tuple ### (route:)?(allow|limit) ' || true; } | { grep -vxF "$expected" || true; } |
      sed 's/^### tuple ### /  /'
  )
  [[ -z "$foreign" ]] ||
    refuse "$(printf 'règles ufw hors de 22, 80 et 443 (aucun autre port public) :\n%s\nLes retirer (sudo ufw status numbered, puis sudo ufw delete <n>), puis relancer' "$foreign")"
}

# Docker ne raccorde DOCKER-USER qu'en démarrant : vérifié sur la machine
# réelle, pour ne jamais finir en succès avec une chaîne sans effet.
check_docker_user_hooked() {
  [[ "$ROOT" == / ]] && ! $DRY_RUN || return 0
  local rules
  rules=$(iptables -S)
  grep -q -- '-j DOCKER-USER' <<<"$rules" ||
    die "Docker ne fait pas passer ses ports publiés par DOCKER-USER : ils échapperaient au pare-feu"
}

configure_firewall() {
  local spec rules_changed=false
  if ! grep -qx 'DEFAULT_INPUT_POLICY="DROP"' "$ROOT/etc/default/ufw" 2>/dev/null; then
    changed "pare-feu : entrées refusées par défaut"
    run ufw default deny incoming
  fi
  if ! grep -qx 'DEFAULT_OUTPUT_POLICY="ACCEPT"' "$ROOT/etc/default/ufw" 2>/dev/null; then
    changed "pare-feu : sorties permises par défaut"
    run ufw default allow outgoing
  fi
  for spec in "${OPEN_PORTS[@]}"; do
    if ! ufw_has_rule "$spec"; then
      changed "pare-feu : $spec ouvert"
      run ufw allow "$spec"
    fi
  done
  replace_block etc/ufw/after.rules DOCKER-USER < <(docker_user_rules) && rules_changed=true
  replace_block etc/ufw/after6.rules DOCKER-USER < <(docker_user_rules) && rules_changed=true
  if ! ufw_enabled; then
    changed "pare-feu activé"
    run ufw --force enable
  elif $rules_changed; then
    run ufw reload
  fi
  check_docker_user_hooked
}

summary() {
  echo
  if ((${#CHANGES[@]} == 0)); then
    echo "Aucun changement : la machine était déjà dans l'état attendu."
    return
  fi
  if $DRY_RUN; then
    echo "Changements prévus (--dry-run : rien n'a été appliqué) :"
  else
    echo "Changements :"
  fi
  printf '  - %s\n' "${CHANGES[@]}"
  echo
  echo "Vérifier une nouvelle connexion (ssh $ADMIN_USER@<machine>) avant de fermer cette session."
}

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --root) ROOT="${2:?--root attend un dossier}"; shift 2 ;;
      --admin-user) ADMIN_USER="${2:?--admin-user attend un nom de compte}"; shift 2 ;;
      --ssh-key) EXTRA_KEYS+=("${2:?--ssh-key attend une clé publique}"); shift 2 ;;
      --dry-run) DRY_RUN=true; shift ;;
      -h | --help) usage ;;
      *) die "option inconnue : $1" ;;
    esac
  done

  [[ "$ADMIN_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ && "$ADMIN_USER" != root ]] ||
    die "--admin-user : minuscules, chiffres, - et _ (ex. ops)"
  local key
  for key in "${EXTRA_KEYS[@]}"; do
    [[ "$key" =~ $KEY_LINE ]] || die "--ssh-key : clé publique attendue (ssh-ed25519 AAAA… commentaire)"
  done
  [[ "$ROOT" != / ]] || $DRY_RUN || ((EUID == 0)) || die "à lancer en root (sudo)"
  check_os
  check_arch
  check_sshd_include
  check_sshd_precedence
  check_foreign_rules
  check_compose
  check_docker_firewall
  collect_keys

  local jail_changed=false
  # Configurations posées avant les paquets : fail2ban démarre avec la sienne.
  write_fail2ban_jail && jail_changed=true
  write_auto_upgrades
  install_packages "${BASE_PACKAGES[@]}"
  configure_admin
  configure_ssh
  configure_fail2ban "$jail_changed"
  configure_docker
  configure_firewall
  summary
  ! $REFUSED
}

main "$@"
