#!/usr/bin/env bash
# Test de bout en bout du provisionnement (INFRA-11), lancé par la CI sur une
# machine Ubuntu jetable : le script tourne pour de vrai, deux fois de suite,
# puis on vérifie depuis un espace réseau séparé (netns « dehors », relié à
# l'hôte comme Internet) ce qu'un attaquant verrait.
#
#   infra/provision/e2e.sh
#
# Ne PAS lancer sur une machine de dev : il durcit SSH et active le pare-feu.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
HOST=192.168.77.1
OUT=192.168.77.2
# Seconde adresse de dehors, que fail2ban doit bannir.
INTRUS=192.168.77.3
HOST6=fd77::1
OUT6=fd77::2
ADMIN=ops
BUSYBOX=busybox:1.37@sha256:bdf57e528e45e4433820e045b29b4597825a1c9e38353532d90a01445013f82e

ok() { echo "OK    $*"; }
ko() {
  echo "ÉCHEC $*" >&2
  exit 1
}

setup_outside() {
  sudo ip netns add dehors
  sudo ip link add veth-hote type veth peer name veth-dehors
  sudo ip link set veth-dehors netns dehors
  sudo ip addr add "$HOST/24" dev veth-hote
  sudo ip link set veth-hote up
  sudo ip netns exec dehors ip addr add "$OUT/24" dev veth-dehors
  sudo ip netns exec dehors ip link set veth-dehors up
  sudo ip netns exec dehors ip addr add "$INTRUS/24" dev veth-dehors
  sudo ip netns exec dehors ip link set lo up
  sudo sysctl -qw net.ipv6.conf.veth-hote.disable_ipv6=0
  sudo ip netns exec dehors sysctl -qw net.ipv6.conf.veth-dehors.disable_ipv6=0
  sudo ip addr add "$HOST6/64" dev veth-hote nodad
  sudo ip netns exec dehors ip addr add "$OUT6/64" dev veth-dehors nodad
}

outside() { sudo ip netns exec dehors "$@"; }

# Joignable en TCP depuis dehors ?
reachable() { outside timeout 5 bash -c "exec 3<>/dev/tcp/$1/$2" 2>/dev/null; }

ssh_from_outside() {
  outside ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=5 "$@"
}

# Un serveur HTTP de test publié par Docker sur un port de l'hôte.
publish() {
  sudo docker run -d --rm --name "$1" -p "$2:8080" "$BUSYBOX" httpd -f -p 8080 -h / >/dev/null
}

# Ce que le provisionnement gère, sans compteurs ni horodatages : deux états
# égaux veulent dire qu'il n'a rien changé. Le PID et l'heure d'activation des
# services disent qu'aucun n'a été redémarré.
state() {
  sudo bash -c '
    find /etc/ssh/sshd_config.d /etc/fail2ban/jail.d /etc/apt/apt.conf.d /etc/apt/sources.list.d \
      /etc/sudoers.d /etc/ufw /etc/default/ufw /etc/docker /home/'"$ADMIN"'/.ssh -type f -print0 |
      sort -z | xargs -0 stat -c "%n %a %U:%G"
    find /etc/ssh/sshd_config.d /etc/fail2ban/jail.d /etc/apt/apt.conf.d /etc/apt/sources.list.d \
      /etc/sudoers.d /etc/ufw /etc/default/ufw /etc/docker /home/'"$ADMIN"'/.ssh -type f -print0 |
      sort -z | xargs -0 sha256sum
    dpkg-query -W -f "\${Package} \${Version} \${db:Status-Status}\n"
    getent passwd '"$ADMIN"'; id '"$ADMIN"'
    ufw status verbose
    iptables -S DOCKER-USER; ip6tables -S DOCKER-USER
    for unit in docker fail2ban ssh; do
      systemctl show -p MainPID -p ActiveEnterTimestampMonotonic -p UnitFileState "$unit"
    done
  '
}

ssh-keygen -q -t ed25519 -N '' -f "$work/admin"
setup_outside

echo "--- À blanc"
# shellcheck disable=SC2024 # journal écrit par l'utilisateur du test, voulu
sudo "$here/provision.sh" --dry-run --ssh-key "$(cat "$work/admin.pub")" >"$work/a-blanc.log"
grep -q 'Changements prévus' "$work/a-blanc.log" || ko "--dry-run n'annonce rien sur une machine neuve"
[[ ! -e /etc/ssh/sshd_config.d/00-personal-os.conf ]] || ko "--dry-run a écrit la configuration sshd"
! getent passwd "$ADMIN" >/dev/null || ko "--dry-run a créé le compte $ADMIN"
ok "--dry-run annonce les changements sans rien appliquer"

echo "--- Premier passage"
sudo "$here/provision.sh" --ssh-key "$(cat "$work/admin.pub")" | tee "$work/premier.log"
state >"$work/apres-premier"

echo "--- Second passage"
sudo "$here/provision.sh" --ssh-key "$(cat "$work/admin.pub")" | tee "$work/second.log"
state >"$work/apres-second"
grep -q '^Aucun changement' "$work/second.log" || ko "le second passage annonce des changements"
diff -u "$work/apres-premier" "$work/apres-second" || ko "le second passage a changé l'état de la machine"
ok "deux passages de suite : le second ne change rien"

conf=$(sudo sshd -T)
grep -qx 'passwordauthentication no' <<<"$conf" || ko "sshd accepte les mots de passe"
grep -qx 'permitrootlogin no' <<<"$conf" || ko "sshd accepte root"
sudo fail2ban-client status sshd >/dev/null || ko "fail2ban ne surveille pas sshd"
[[ "$(apt-config shell V APT::Periodic::Unattended-Upgrade)" == "V='1'" ]] || ko "mises à jour automatiques inactives"
sudo docker compose version >/dev/null || ko "Docker Compose absent"
sudo -u "$ADMIN" sudo -n true || ko "$ADMIN n'a pas sudo"
ok "sshd par clé, fail2ban, mises à jour automatiques, Docker Compose, sudo"

ssh_from_outside -i "$work/admin" "$ADMIN@$HOST" true || ko "l'administrateur ne se connecte pas avec sa clé"
ok "l'administrateur se connecte avec sa clé"
out=$(ssh_from_outside -o PubkeyAuthentication=no "$ADMIN@$HOST" true 2>&1) && ko "connexion sans clé acceptée"
grep -q 'Permission denied (publickey)' <<<"$out" || ko "refus inattendu : $out"
ssh_from_outside -i "$work/admin" "root@$HOST" true 2>/dev/null && ko "root se connecte"
ok "mot de passe et root refusés"

# Six essais sur un compte inexistant : fail2ban bannit l'adresse.
for _ in 1 2 3 4 5 6; do
  ssh_from_outside -b "$INTRUS" -o PubkeyAuthentication=no "intrus@$HOST" true 2>/dev/null || true
done
for _ in $(seq 10); do
  sudo fail2ban-client status sshd | grep -q "$INTRUS" && break
  sleep 1
done
sudo fail2ban-client status sshd | grep -q "$INTRUS" || ko "fail2ban n'a pas banni $INTRUS après six échecs"
ssh_from_outside -i "$work/admin" "$ADMIN@$HOST" true || ko "l'administrateur banni avec l'intrus"
ok "fail2ban bannit l'intrus, pas l'administrateur"

publish web-test 80
publish tls-test 443
publish interne-test 8080
# Un service de l'hôte hors des ports ouverts : ufw le ferme (INPUT).
sudo python3 -m http.server 8081 --bind :: >/dev/null 2>&1 &
sleep 2

check_ports() {
  local port
  for port in 80 443; do
    reachable "$HOST" "$port" || ko "port $port publié par Docker injoignable de dehors"
    reachable "$HOST6" "$port" || ko "port $port publié par Docker injoignable de dehors en IPv6"
  done
  for port in 8080 8081; do
    reachable "$HOST" "$port" && ko "port $port joignable de dehors"
    reachable "$HOST6" "$port" && ko "port $port joignable de dehors en IPv6"
  done
  # Le port fermé l'est de dehors seulement : l'hôte, lui, le joint.
  timeout 5 bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080' || ko "port 8080 injoignable depuis l'hôte"
  true
}
check_ports
ok "de dehors : 80 et 443 publiés par Docker joignables, 8080 (Docker) et 8081 (hôte) fermés"

# Relancé sur une machine en service : rien ne bouge, rien ne s'ouvre.
sudo "$here/provision.sh" | tee "$work/troisieme.log"
grep -q '^Aucun changement' "$work/troisieme.log" || ko "le passage sur une machine en service annonce des changements"
check_ports
ok "relancé sur une machine en service : aucun changement, aucun port ouvert"

# Docker fait bien passer ses ports publiés par la chaîne posée : sans ce
# raccordement (backend nftables), DOCKER-USER serait sans effet.
# Lue en entier : sous pipefail, grep -q fermerait le tube (SIGPIPE).
regles=$(sudo iptables -S)
grep -q -- '-j DOCKER-USER' <<<"$regles" || ko "Docker ne raccorde pas DOCKER-USER"
ok "Docker fait passer ses ports publiés par DOCKER-USER"

# Une autorisation ufw sur 8080, posée à la main, ouvre le conteneur publié
# sur 8080 en IPv6 (docker-proxy, par INPUT) : le script refuse de passer,
# sans rien modifier, tant qu'elle reste.
sudo ufw allow 8080/tcp >/dev/null
reachable "$HOST6" 8080 || ko "témoin : l'autorisation ufw sur 8080 n'ouvre pas le conteneur en IPv6"
state >"$work/avant-refus"
# shellcheck disable=SC2024 # journal écrit par l'utilisateur du test, voulu
if sudo "$here/provision.sh" >"$work/refus.log" 2>&1; then
  ko "le script passe malgré une autorisation ufw sur 8080"
fi
grep -q 'allow tcp 8080' "$work/refus.log" || ko "le refus ne cite pas la règle : $(cat "$work/refus.log")"
state >"$work/apres-refus"
diff -u "$work/avant-refus" "$work/apres-refus" || ko "le passage refusé a modifié la machine"
sudo ufw delete allow 8080/tcp >/dev/null
sudo "$here/provision.sh" | tee "$work/apres-retrait.log"
grep -q '^Aucun changement' "$work/apres-retrait.log" || ko "le passage après retrait de la règle annonce des changements"
check_ports
ok "une autorisation ufw hors de 22/80/443 fait refuser le passage, sans modification"
