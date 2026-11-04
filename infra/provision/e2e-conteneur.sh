#!/usr/bin/env bash
# Lance e2e.sh dans une machine jetable : un conteneur systemd privilégié, à
# partir de l'image d'un système fraîchement livré (CI : job
# « Provisionnement » ; en local aussi, sans risque pour la machine hôte).
#
#   infra/provision/e2e-conteneur.sh ubuntu:24.04
#   infra/provision/e2e-conteneur.sh debian:12
#
# Docker et containerd du conteneur écrivent dans des volumes : un overlay
# monté dans un overlay est refusé par le noyau.
set -euo pipefail

image="${1:?usage: infra/provision/e2e-conteneur.sh <image> (ex. ubuntu:24.04)}"
here="$(cd "$(dirname "$0")" && pwd)"
name="personal-os-provision-e2e-$$"

cleanup() { docker rm -f -v "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Le strict nécessaire d'une image cloud : systemd, OpenSSH, ip, python3 (pour
# le service de témoin d'e2e.sh) et sudo. La politique des images Docker qui
# interdit de démarrer les services est retirée : une vraie machine n'en a pas.
docker run -d --name "$name" --privileged --cgroupns=host \
  -v /sys/fs/cgroup:/sys/fs/cgroup:rw --tmpfs /run --tmpfs /run/lock \
  -v /var/lib/docker -v /var/lib/containerd \
  -v "$here:/src:ro" "$image" \
  bash -c 'apt-get update -qq &&
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
      systemd systemd-sysv dbus openssh-server iproute2 python3 sudo >/dev/null &&
    rm -f /usr/sbin/policy-rc.d &&
    exec /sbin/init' >/dev/null

for _ in $(seq 120); do
  status=$(docker exec "$name" systemctl is-system-running 2>/dev/null || true)
  [[ "$status" == running || "$status" == degraded ]] && break
  sleep 2
done
[[ "$status" == running || "$status" == degraded ]] || {
  docker logs "$name" | tail -20 >&2
  echo "systemd n'a pas démarré dans $image ($status)" >&2
  exit 1
}

docker exec "$name" bash /src/e2e.sh
