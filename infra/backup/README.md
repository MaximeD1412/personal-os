# Sauvegardes Restic

Sauvegarde chiffrée de Personal OS vers un fournisseur de stockage **autre que
celui du serveur** ([ADR 0020](../../docs/adr/0020-sauvegardes-restic-chez-un-autre-fournisseur.md)),
et restauration scriptée réutilisable comme banc d'essai de migration
([ADR 0021](../../docs/adr/0021-pas-de-staging-la-restauration-sert-de-banc-d-essai.md)).

| Fichier                 | Rôle                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `bin/backup.sh`         | Dump PostgreSQL, envoi vers Restic, rétention, vérification               |
| `bin/restore.sh`        | Restauration vers une cible jetable, remontée optionnelle dans PostgreSQL |
| `bin/notify-failure.sh` | Courriel + témoin d'inactivité, appelé par `OnFailure=`                   |
| `bin/watch.sh`          | Vérifie qu'un instantané a moins de 26 heures, toutes les 6 heures        |
| `bin/install.sh`        | Pose les scripts et les unités systemd, idempotent                        |
| `backup.conf.example`   | Configuration — cibles, rétention, alertes. **Sans secret**               |
| `restic.env.example`    | Modèle de secrets. Le fichier renseigné n'entre jamais dans Git           |

## Périmètre actuel

Couvert aujourd'hui : **toutes les bases** nommées dans `POSTGRES_DATABASES` —
celle de l'application et celle d'**Authentik**
([ADR 0027](../../docs/adr/0027-un-seul-postgresql-pour-l-application-et-authentik.md)) —
et les fichiers de configuration listés dans `BACKUP_PATHS`, où figurent
désormais les médias et certificats d'Authentik.

Toute la configuration d'Authentik — fournisseur OIDC, comptes, flux — vit en
**base**, pas dans des fichiers : c'est `POSTGRES_DATABASES` qui l'emporte, pas
`BACKUP_PATHS`. N'en sauvegarder qu'une laisserait une restauration où
l'application revient intacte mais où plus personne ne peut se connecter.

Le **stockage objet** (le CV du portfolio, #23) vit dans un bucket OVH, pas
sur la machine : `BACKUP_PATHS` ne peut pas l'atteindre. Quand `S3_MIRROR_BUCKET`
est renseigné dans `backup.conf`, le script le recopie d'abord dans le transit
(rclone, dans un conteneur à version fixée), sous `objets/`. Ses clés vivent
dans `restic.env` et passent à rclone par l'environnement, jamais par la ligne
de commande. Une copie qui échoue interrompt la sauvegarde, plutôt qu'un
instantané auquel il manquerait les fichiers. rclone écrit dans son conteneur,
et `docker cp` en extrait les fichiers : un montage `-v` serait résolu par le
démon Docker dans le `/tmp` de la machine, pas dans le `/tmp` privé du service
(`PrivateTmp=yes`), et Restic sauvegarderait un dossier vide.

Les deux bases et le bucket partent dans le **même** instantané, sous
`postgres/<base>.dump` et `objets/`. Deux instantanés séparés se
restaureraient à des dates différentes, et plus rien ne garantirait que les
comptes correspondent aux données.

## Ce qui ne peut pas être automatisé

Trois gestes demandent une intervention humaine et ne sont pas dans ce dépôt.

### 1. Compte et bucket chez le fournisseur

Créer un compte Backblaze B2 (ou équivalent), **activer la 2FA**, puis un bucket :

- **privé** ;
- **sans Object Lock** — `restic forget --prune` doit pouvoir supprimer, sinon la
  rétention ne s'applique plus et le dépôt grossit indéfiniment ;
- **cycle de vie « ne garder que la dernière version »** — sans cette règle, B2
  conserve les versions masquées et `prune` ne libère jamais rien ;
- **chiffrement par défaut activé** : gratuit et transparent, même s'il n'ajoute
  presque rien puisque Restic chiffre déjà côté client.

Créer ensuite une clé applicative **restreinte à ce bucket**, jamais la clé
maître du compte : elle ne peut pas être révoquée isolément.

### 2. Pose des secrets sur la machine

La clé se **génère sur la machine** et n'en sort pas.

```bash
install -d -m 700 /etc/personal-os
openssl rand -base64 48 > /etc/personal-os/restic-password
chmod 600 /etc/personal-os/restic-password

cp restic.env.example /etc/personal-os/restic.env
chmod 600 /etc/personal-os/restic.env
# renseigner RESTIC_REPOSITORY, B2_ACCOUNT_ID, B2_ACCOUNT_KEY,
# et S3_MIRROR_ACCESS_KEY_ID, S3_MIRROR_SECRET_ACCESS_KEY pour le bucket,
# et BACKUP_STATUS_TOKEN : la même valeur que dans /opt/personal-os/.env (voir plus bas)

set -a; . /etc/personal-os/restic.env; set +a
restic init      # UNE SEULE FOIS — voir l'avertissement ci-dessous
restic snapshots # doit répondre, liste vide
```

> **`restic init` ne se lance qu'une fois.** Une faute de frappe dans
> `RESTIC_REPOSITORY` ne produit pas d'erreur : elle crée un **second dépôt
> vide** à côté du premier, et les anciens instantanés semblent avoir disparu.
> En cas de doute, `restic snapshots` avant tout.

> **La clé doit avoir une copie hors ligne.** Si la machine est perdue, la clé
> l'est aussi, et le dépôt chiffré devient définitivement illisible : la
> sauvegarde existe mais ne vaut plus rien. L'ADR 0020 interdit de confier la
> clé à un tiers — une copie **papier dans un coffre physique** ne viole pas
> cette règle et couvre précisément ce scénario. À faire **avant** la première
> sauvegarde.

Puis installer :

```bash
sudo ./bin/install.sh
sudo /opt/personal-os/backup/bin/backup.sh --dry-run   # relire le plan
```

### 3. Vérification de restauration

Une restauration qui rend la main ne prouve rien — elle prouve que des fichiers
sont revenus, pas qu'ils sont exploitables.

```bash
sudo /opt/personal-os/backup/bin/restore.sh \
  --target /var/tmp/verification --read-data --into-postgres
```

`--read-data` relit **tous** les paquets du dépôt : c'est long et ça consomme du
trafic entrant, mais c'est la seule façon de détecter une corruption silencieuse.
Le script se termine sur une requête qui compte les tables de la base restaurée,
et échoue si elle est vide.

Sans autre précision, c'est la base de l'**application** qui remonte —
`POSTGRES_DB`, celle qu'attend le banc d'essai de migration. Pour vérifier
celle d'Authentik, la nommer :

```bash
sudo /opt/personal-os/backup/bin/restore.sh \
  --target /var/tmp/verification-authentik --into-postgres --database authentik
```

Une base qui n'est pas dans `POSTGRES_DATABASES` est refusée tout de suite,
plutôt qu'après une restauration complète sous la forme d'un « aucun dump » qui
ne dirait pas pourquoi.

**Chronométrer cette exécution** : cette durée est le RTO réel, et le
déploiement (#4) la paiera à chaque livraison.

Les fichiers du **stockage objet** reviennent avec le reste, sous `objets/`
dans la cible. Rien ne les repose seul dans le bucket : un bucket perdu se
recrée (`infra/deploy`, « Le stockage objet OVH »), puis on y recopie le
dossier restauré, avec les mêmes variables `RCLONE_CONFIG_OBJETS_*` que
`backup.sh` :

```bash
rclone copy /var/tmp/verification/<chemin>/objets "objets:$S3_MIRROR_BUCKET"
```

## Exploitation courante

```bash
systemctl list-timers personal-os-backup.timer   # prochaine exécution
journalctl -u personal-os-backup.service -n 50   # dernière exécution
systemctl start personal-os-backup.service       # déclencher à la main
systemctl list-timers personal-os-backup-watch.timer  # prochaine vérification
journalctl -u personal-os-backup-watch.service -n 5   # dernière vérification
```

Le timer tourne à 03:30 avec `Persistent=true` : une exécution manquée pendant
un arrêt machine est rattrapée au démarrage suivant, plutôt que sautée.

## Signalement d'échec

Deux canaux, parce qu'ils tombent en panne différemment.

- **`OnFailure=` systemd** envoie un courriel avec les 50 dernières lignes du
  journal. Il dit _pourquoi_, mais dépend d'un relais SMTP.
- **Témoin d'inactivité** (`BACKUP_HEARTBEAT_URL`) : pingué au démarrage et au
  succès. Il dit seulement _que_ quelque chose ne va pas, mais c'est le seul à
  détecter le mode de panne dangereux — la sauvegarde qui **ne tourne plus du
  tout**. Un `OnFailure` ne se déclenche que si l'unité s'exécute ; timer masqué
  ou machine éteinte, personne n'est prévenu.

## État transmis au tableau de bord

L'API ne voit pas Restic. À la fin de chaque exécution, réussie ou non,
`backup.sh` lui transmet son résultat (`report_status`, `lib/common.sh`) :
l'Accueil du tableau de bord affiche la date de la dernière sauvegarde
réussie, et la signale en À faire au-delà de 26 heures (DASH-3).

- **L'adresse** : `BACKUP_STATUS_URL` dans `backup.conf`, le port de l'API
  publié sur la machine (`http://127.0.0.1:3001/api/internal/backup-status`).
  Vide, rien n'est transmis. La route n'est pas routée par le proxy du tableau
  de bord : elle ne se joint que de la machine.
- **Le jeton** : `BACKUP_STATUS_TOKEN` dans `restic.env`, la même valeur que
  dans `/opt/personal-os/.env` (modèle : `infra/deploy/stack.env.example`), côté API. Il se génère sur la machine
  (`openssl rand -hex 32`) et passe à curl par son entrée, jamais par sa ligne
  de commande.
- **Un échec transmet sa cause** : le message du `die`, ou la commande qui a
  interrompu le script. Une réussite efface la cause du dernier échec. Les
  contrôles préalables (clé, liste des bases, paramètres du bucket) sont
  couverts dès que `backup.conf` et `restic.env` sont lus ; une configuration
  illisible ne peut rien transmettre, et `--dry-run` ne transmet jamais rien.
- **Une API injoignable n'échoue pas la sauvegarde** : le journal le note, et
  le courriel d'échec comme le témoin d'inactivité restent les alertes.

Vérifier après la pose du jeton, des deux côtés :

```bash
sudo systemctl start personal-os-backup.service
journalctl -u personal-os-backup.service -n 5   # sans « état non transmis »
```

puis l'Accueil montre la sauvegarde qui vient de se terminer.

## Vérification de fraîcheur

Le témoin d'inactivité dépend d'un service extérieur et d'une URL qu'on peut
oublier de renseigner. Une seconde garde tourne donc **sur la machine**,
indépendamment de la sauvegarde : `personal-os-backup-watch.timer`, toutes les
6 heures (00:00, 06:00, 12:00, 18:00, rattrapées au démarrage).

`bin/watch.sh` lit le dépôt Restic lui-même — `restic snapshots --no-lock
--tag personal-os --latest 1 --json` — et retient l'horodatage du plus récent
instantané. Il surveille donc **ce qui est arrivé chez le fournisseur**, pas ce
que l'unité de sauvegarde croit avoir fait. L'unité échoue, et l'alerte part
par le même `OnFailure=` que la sauvegarde (courriel + témoin en échec), dans
trois cas :

- le dernier instantané a **plus de 26 heures** (une sauvegarde quotidienne
  plus sa marge) : timer désactivé, unité absente après une réinstallation,
  sauvegarde qui échoue depuis plus d'un jour ;
- le dépôt n'a **aucun instantané** ;
- le dépôt **ne répond pas** (identifiants révoqués, fournisseur injoignable) :
  ne pas pouvoir vérifier vaut alerte.

Elle ne couvre pas la machine éteinte : rien ne tourne pour le dire. C'est le
rôle du témoin d'inactivité.

### Tester l'alerte

Sans attendre 26 heures, en faisant pointer la vérification sur un dépôt vide :

```bash
sudo restic init --repo /var/tmp/depot-vide --password-file /etc/personal-os/restic-password
sudo RESTIC_ENV_FILE=/dev/null RESTIC_REPOSITORY=/var/tmp/depot-vide \
  RESTIC_PASSWORD_FILE=/etc/personal-os/restic-password \
  /opt/personal-os/backup/bin/watch.sh; echo "code $?"
# attendu : « ERREUR: aucun instantané dans /var/tmp/depot-vide », code 1
sudo /opt/personal-os/backup/bin/notify-failure.sh personal-os-backup-watch.service
sudo rm -rf /var/tmp/depot-vide
```

`notify-failure.sh` est ce que lance `OnFailure=` : le courriel doit arriver à
`BACKUP_ALERT_EMAIL`, et le témoin passer en échec. La sauvegarde suivante le
remet au vert. Contre le vrai dépôt, `systemctl start
personal-os-backup-watch.service` doit réussir et journaliser l'âge de la
dernière sauvegarde.

## Tests

```bash
pnpm exec nx run backup:test              # dry-run, garde-fous, refus, fraîcheur — sans infrastructure
pnpm exec nx run backup:test-integration  # va-et-vient réel — exige restic et docker
```

La vérification de fraîcheur est aussi testée contre un vrai dépôt Restic local,
avec des instantanés datés dans le passé (`restic backup --time`).

La campagne d'intégration initialise un vrai dépôt Restic local, sauvegarde une
base PostgreSQL semée, la restaure dans un conteneur jetable et **interroge la
base restaurée**. Elle recopie aussi un bucket servi par un serveur S3 jetable
(`rclone serve s3`), le script tournant sous un `/tmp` privé comme celui du
service (`unshare`, qui exige les espaces de noms utilisateur), et lit le CV
dans l'instantané. Simuler Restic reviendrait à tester la simulation, alors que
c'est justement la restauration qu'on ne peut pas croire sur parole.

## Migration vers le homelab

La clé ne se recopie pas d'une machine à l'autre : voir
[`docs/migration-homelab.md`](../../docs/migration-homelab.md).
