# Provisionnement de la machine

Changer de machine revient à relancer ce script, redéployer et basculer le DNS
([migration vers le homelab](../../docs/migration-homelab.md)). Il prend une
machine Debian 12+ ou Ubuntu 22.04+, x86 ou ARM, chez n'importe quel
hébergeur, et la met dans l'état attendu. **Idempotent** : relancé sur une
machine déjà en ordre, il ne change rien et le dit.

| Fichier | Rôle |
| --- | --- |
| `provision.sh` | Le script. Seul fichier à copier sur la machine |
| `e2e.sh` | Le passage réel, deux fois de suite, vérifié depuis un réseau « dehors ». **Jamais sur un poste de dev** |
| `e2e-conteneur.sh` | Lance `e2e.sh` dans un conteneur systemd jetable : la CI, ou un essai local sans risque |
| `src/` | Tests unitaires, sur une racine factice |

## Ce qu'il pose

| Brique | État attendu |
| --- | --- |
| SSH | Clé uniquement, root refusé (`/etc/ssh/sshd_config.d/00-personal-os.conf`). Vérifié par `sshd -T` après rechargement |
| Administration | Le compte `ops` (ou `--admin-user`), sudo sans mot de passe, membre du groupe `docker` |
| fail2ban | La prison `sshd`, lue dans le journal systemd : 5 échecs en 10 min, 1 h de bannissement |
| Pare-feu | ufw : entrées refusées par défaut, seuls 22, 80 et 443 ouverts |
| Ports publiés par Docker | Chaîne `DOCKER-USER` : de dehors, seuls 80 et 443 passent |
| Mises à jour | Sécurité chaque jour ; redémarrage à 05:00 seulement si une mise à jour l'exige |
| Docker | Docker CE et Compose depuis `download.docker.com` ; journaux bornés, `live-restore` |

### Pourquoi `DOCKER-USER`

Docker publie un port par une traduction d'adresse (DNAT) faite **avant** les
règles d'entrée d'ufw. Sans rien d'autre, un `ports: "5432:5432"` serait ouvert
sur Internet, pare-feu actif ou non. Le script ajoute donc à
`/etc/ufw/after.rules` (et `after6.rules`) un bloc balisé
`# BEGIN PERSONAL-OS DOCKER-USER` : une connexion venue de dehors vers un port
publié ne passe que si elle visait 80 ou 443 côté hôte. Les réseaux Docker
entre eux, et les réponses, passent. Un service publié sur `127.0.0.1` (toute
la pile de Personal OS) n'est pas concerné.

## Lancer

```bash
scp infra/provision/provision.sh <compte>@<machine>:
ssh <compte>@<machine>
sudo ./provision.sh --dry-run    # ce qui changerait, avec les différences
sudo ./provision.sh
```

Le compte d'administration reçoit les clés de root et du compte qui lance
`sudo`, plus celles passées par `--ssh-key` (répétable). Une clé à options
(`command=`, `from=`…) n'est jamais recopiée : sans ses options, elle donnerait
plus qu'on ne lui avait donné. Sans aucune clé, le script s'arrête **avant** de
couper les mots de passe.

**Ouvrir une nouvelle session (`ssh ops@<machine>`) avant de fermer
celle-ci.**

### Sur une machine déjà en service

Le VPS est partagé avec d'autres projets : le script ne casse rien de ce qui
tourne.

- **Docker n'est jamais redémarré** : redémarrer `dockerd` couperait les
  conteneurs de tous les projets. Sa configuration est rechargée à chaud ;
  `live-restore` s'applique tout de suite, les journaux bornés au prochain
  démarrage du démon (le redémarrage qui suit une mise à jour du noyau). Un
  Docker arrêté est démarré, et lit alors sa configuration.
- **Une autorisation ufw hors de 22, 80 et 443 fait refuser le passage**,
  avant toute modification : en IPv6, Docker relaie un port publié par
  docker-proxy, qui passe par INPUT, si bien qu'un `ufw allow 8080/tcp` ouvrirait
  aussi un conteneur publié sur 8080. Elle n'est pas retirée en silence (un
  autre projet en dépend peut-être) : le script la cite, à retirer à la main
  (`ufw status numbered`, puis `ufw delete <n>`), puis à relancer.
- **Refusée aussi, à chaque passage, avant toute modification** : une
  directive sshd contraire au durcissement lue avant `00-personal-os.conf`
  (dans `sshd_config` avant l'`Include`, ou dans un fichier de
  `sshd_config.d` trié avant), puisque sshd garde la première valeur lue, ou
  dans un bloc `Match` où qu'il soit (il remplacerait la valeur globale pour
  les connexions qu'il désigne). La configuration effective est en plus
  vérifiée à chaque passage, pour root et pour l'administrateur
  (`sshd -T -C user=…`).
- **Refusés aussi, avant toute modification** : un Docker installé hors du
  dépôt officiel sans Compose (`docker.io`), et un `daemon.json` avec
  `"firewall-backend": "nftables"` ou `"iptables": false` (Docker ne
  raccorderait pas `DOCKER-USER`). Après le pare-feu, le script vérifie que
  Docker raccorde bien la chaîne, et échoue sinon.
- En `--dry-run`, un refus est annoncé, le plan affiché quand même, et le code
  de sortie vaut 1.
- **Un port publié par Docker sur l'IP publique, hors de 80 et 443, est
  fermé.** C'est le but (`mairie-postgres-1`, voir la migration), mais un
  service qui en dépendait de dehors cesse de répondre.
- Aucun `AllowUsers` : les autres comptes, dont l'utilisateur `deploy` de
  l'[ADR 0032](../../docs/adr/0032-deploiement-pousse-par-une-cle-ssh-bridee.md),
  gardent leur accès par clé.

## Vérifier

- `pnpm exec nx test provision` : ce que le script écrirait et lancerait, sur
  une racine factice (`--root`), dont l'idempotence sur une machine déjà
  provisionnée.
- Le job CI « Provisionnement » : `e2e-conteneur.sh` sur Ubuntu 22.04 et
  24.04, Debian 12, et Ubuntu 24.04 ARM. En local, la même commande :

  ```bash
  infra/provision/e2e-conteneur.sh debian:12
  ```

  Deux passages de suite, le second ne doit rien changer (fichiers gérés,
  paquets, règles, PID des services) ; puis, depuis un réseau « dehors » :
  connexion par clé, mot de passe et root refusés, bannissement par fail2ban,
  80 et 443 publiés par Docker joignables, 8080 publié par Docker et 8081 sur
  l'hôte fermés, en IPv4 comme en IPv6.
