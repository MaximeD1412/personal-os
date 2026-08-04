# Sauvegardes Restic

Sauvegarde chiffrée de Personal OS vers un fournisseur de stockage **autre que
celui du serveur** ([ADR 0020](../../docs/adr/0020-sauvegardes-restic-chez-un-autre-fournisseur.md)),
et restauration scriptée réutilisable comme banc d'essai de migration
([ADR 0021](../../docs/adr/0021-pas-de-staging-la-restauration-sert-de-banc-d-essai.md)).

| Fichier | Rôle |
| --- | --- |
| `bin/backup.sh` | Dump PostgreSQL, envoi vers Restic, rétention, vérification |
| `bin/restore.sh` | Restauration vers une cible jetable, remontée optionnelle dans PostgreSQL |
| `bin/notify-failure.sh` | Courriel + témoin d'inactivité, appelé par `OnFailure=` |
| `bin/install.sh` | Pose les scripts et les unités systemd, idempotent |
| `backup.conf.example` | Configuration — cibles, rétention, alertes. **Sans secret** |
| `restic.env.example` | Modèle de secrets. Le fichier renseigné n'entre jamais dans Git |

## Périmètre actuel

Couvert aujourd'hui : **PostgreSQL** et les fichiers de configuration listés dans
`BACKUP_PATHS`.

Pas encore couvert, faute d'exister : la base et la configuration **Authentik**
(issue #5) et le **stockage objet**. Les deux s'ajoutent en une ligne de
`BACKUP_PATHS` — c'est la raison d'être de ce fichier de configuration, et
aucune modification de script ne sera nécessaire.

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
# renseigner RESTIC_REPOSITORY, B2_ACCOUNT_ID, B2_ACCOUNT_KEY

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

**Chronométrer cette exécution** : cette durée est le RTO réel, et le
déploiement (#4) la paiera à chaque livraison.

## Exploitation courante

```bash
systemctl list-timers personal-os-backup.timer   # prochaine exécution
journalctl -u personal-os-backup.service -n 50   # dernière exécution
systemctl start personal-os-backup.service       # déclencher à la main
```

Le timer tourne à 03:30 avec `Persistent=true` : une exécution manquée pendant
un arrêt machine est rattrapée au démarrage suivant, plutôt que sautée.

## Signalement d'échec

Deux canaux, parce qu'ils tombent en panne différemment.

- **`OnFailure=` systemd** envoie un courriel avec les 50 dernières lignes du
  journal. Il dit *pourquoi*, mais dépend d'un relais SMTP.
- **Témoin d'inactivité** (`BACKUP_HEARTBEAT_URL`) : pingué au démarrage et au
  succès. Il dit seulement *que* quelque chose ne va pas, mais c'est le seul à
  détecter le mode de panne dangereux — la sauvegarde qui **ne tourne plus du
  tout**. Un `OnFailure` ne se déclenche que si l'unité s'exécute ; timer masqué
  ou machine éteinte, personne n'est prévenu.

## Tests

```bash
pnpm exec nx run backup:test              # dry-run, garde-fous, refus — sans infrastructure
pnpm exec nx run backup:test-integration  # va-et-vient réel — exige restic et docker
```

La campagne d'intégration initialise un vrai dépôt Restic local, sauvegarde une
base PostgreSQL semée, la restaure dans un conteneur jetable et **interroge la
base restaurée**. Simuler Restic reviendrait à tester la simulation, alors que
c'est justement la restauration qu'on ne peut pas croire sur parole.

## Migration vers le homelab

La clé ne se recopie pas d'une machine à l'autre : voir
[`docs/migration-homelab.md`](../../docs/migration-homelab.md).
