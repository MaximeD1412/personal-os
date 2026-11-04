# Déploiement poussé par GitHub

Un commit atteignant la branche principale part en production
([ADR 0023](../../docs/adr/0023-deploiement-automatique-tire-par-le-vps.md)
pour la séquence, [ADR 0032](../../docs/adr/0032-deploiement-pousse-par-une-cle-ssh-bridee.md)
pour son déclenchement). La branche principale est une branche de **livraison** :
fusionner signifie livrer. Un commit atteignant `develop` part sur le staging
de démonstration.

| Fichier | Rôle |
| --- | --- |
| `bin/deploy.sh` | La séquence complète : répétition, migration, redémarrage, santé, retour arrière |
| `bin/deploy-staging.sh` | Le staging de démonstration : images d'un commit, migration, jeu de démo, santé |
| `bin/deploy-trigger` | La commande forcée des clés de GitHub : n'accepte que `deploy <env> <sha>` |
| `bin/install-access.sh` | Pose l'utilisateur `deploy`, ses clés forcées et sa règle sudo. Lancé par `install.sh` |
| `bin/notify-failure.sh` | Courriel d'échec, appelé par `deploy-trigger` |
| `bin/install.sh` | Pose l'agent, la pile, l'accès de GitHub ; retire l'ancien minuteur. Idempotent |
| `docker-compose.prod.yml` | La pile de production. Ne construit rien : elle tire des images |
| `caddy/` | Carte de routage de Personal OS — portfolio, tableau de bord, Authentik |
| `deploy.conf.example` | Configuration de l'agent. **Sans secret** |
| `ghcr.env.example` | Modèle de jeton de lecture du registre. Jamais dans Git |
| `stack.env.example` | Modèle d'environnement de la pile. Jamais dans Git |
| `docker-compose.staging.yml` | La pile du staging : un projet à part, plafonné à 1 CPU et 1 Go |
| `staging.env.example` | Modèle d'environnement du staging. Jamais dans Git |

## Le sens de circulation

GitHub Actions construit, teste et pousse les images sur GHCR, puis **se
connecte au VPS** pour demander le déploiement du commit. Le déploiement
s'exécute pendant le job : son journal s'affiche dans GitHub, et le job est
rouge si le déploiement échoue ou finit par un retour arrière.

```
   fusion sur develop                        fusion sur main
         │                                         │
         ▼                                         ▼
   CI : vérification                         Livraison : campagne complète
         │                                         │
         ▼                                         ▼
   GHCR : api, dashboard, portfolio          GHCR : api, dashboard, portfolio,
          en <commit>                               edge en <commit>, puis canal
         │                                          `main` déplacé
         ▼                                         ▼
   ssh deploy@VPS                            ssh deploy@VPS
     deploy staging <commit>                   deploy prod <commit>
     (clé du staging)                          (clé de la production)
         │                                         │
         ▼                                         ▼
   deploy-staging.sh <commit>                deploy.sh --force <commit>
   migration ▸ jeu de démo ▸ santé           répétition ▸ migration ▸ santé
                                             ▸ (retour arrière)
```

Il n'y a plus de minuteur : `install.sh` retire celui de l'ancien déploiement
tiré, pour qu'il n'y ait qu'une seule façon de déclencher un déploiement
automatique. L'agent reste lançable à la main sur la machine.

## Ce que la clé de GitHub permet, et ce qu'elle ne permet pas

GitHub détient deux clés privées, une par environnement. Côté VPS, chacune est
posée dans `/home/deploy/.ssh/authorized_keys` avec une **commande forcée** :

```
command="/opt/personal-os/deploy/bin/deploy-trigger staging",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,restrict ssh-ed25519 AAAA… personal-os-deploy-staging
```

Quoi que le client demande, sshd lance `deploy-trigger staging`, qui lit la
demande dans `SSH_ORIGINAL_COMMAND`.

**Ce qu'elle permet** : redéployer, sur son environnement, un commit dont les
images sont publiées. Rien d'autre.

- La demande doit valoir exactement `deploy <env> <sha>`, où `<env>` est celui
  de la clé et `<sha>` un commit de 40 caractères hexadécimaux minuscules.
  `ls`, une session sans commande, un argument de plus, une seconde ligne, la
  clé du staging qui demande la prod : tout est refusé, sortie 2, sans rien
  lancer.
- Un seul déploiement à la fois par environnement : le second attend la fin du
  premier.
- Un job annulé ou une connexion coupée n'interrompent pas le déploiement : il
  va au bout, et son journal reste sur la machine.

**Ce qu'elle ne permet pas** :

- ni shell, ni pseudo-terminal, ni redirection de port, d'agent ou de X11 ;
- ni lecture des secrets de la machine (`/etc/personal-os/`, `.env`, la clé
  Restic) : l'utilisateur `deploy` n'a de droit sur rien ;
- ni Docker : `deploy` n'est pas dans le groupe `docker`, qui vaudrait root ;
- ni ajout ou retrait de clé : son `.ssh` appartient à root.

Pour lancer le déploiement en root, `deploy-trigger` se relance par `sudo`, et
la règle posée par `install-access.sh` ne lui ouvre que lui :

```
Defaults!/opt/personal-os/deploy/bin/deploy-trigger env_keep += "SSH_ORIGINAL_COMMAND"
deploy ALL=(root) NOPASSWD: /opt/personal-os/deploy/bin/deploy-trigger prod, /opt/personal-os/deploy/bin/deploy-trigger staging
```

La copie root revérifie la demande avant d'aller plus loin. `sudo -l -U deploy`
le montre sur la machine.

> **Pourquoi `/bin/sh` et pas `/usr/sbin/nologin`.** sshd lance la commande
> forcée **par le shell de l'utilisateur** : avec `nologin`, elle ne s'exécute
> jamais (« This account is currently not available. »). Aucun shell n'est
> atteignable pour autant : pas de mot de passe (`*`), et chaque clé
> d'`authorized_keys` est forcée.

> **Le VPS n'est pas dédié.** Si un utilisateur `deploy` existe déjà, posé par
> un autre projet, `install-access.sh` refuse d'y toucher : le sien porte un
> marqueur dans son champ GECOS.

Un compte GitHub compromis peut redéployer un commit publié, y compris un
ancien (ADR 0032). Il pouvait déjà publier sur `main` ; la clé n'ajoute pas de
pouvoir nouveau.

## La séquence

1. **Le commit**, donné par GitHub. Lancé à la main sans commit, l'agent lit le
   libellé `org.opencontainers.image.revision` de `api:main` — quelques
   kilo-octets de manifeste, pas une image. C'est toujours un **commit** qu'il
   déploie, jamais un tag mouvant : un tag désignerait autre chose demain, et
   le retour arrière n'aurait plus de cible.
2. **Répétition.** La dernière sauvegarde est restaurée dans un conteneur
   jetable, et la migration y est rejouée
   ([ADR 0021](../../docs/adr/0021-pas-de-staging-la-restauration-sert-de-banc-d-essai.md)).
   Si elle échoue, tout s'arrête : la production n'a pas bougé, les images ne
   sont même pas récupérées. Ce geste teste la migration **et** la sauvegarde.
   La clé Restic ne quitte jamais la machine.
3. **Reprise de la pile.** Le compose et le routage sont repris du dépôt à la
   révision déployée. Sans ça, une livraison qui ajoute un service publierait
   ses images sans la configuration qui les branche.
4. **Migration réelle**, puis redémarrage sur les nouvelles images.
5. **Santé.** Si l'API ne répond pas, les **images précédentes** reviennent. La
   base n'est jamais touchée
   ([ADR 0024](../../docs/adr/0024-migrations-toujours-compatibles-avec-la-version-precedente.md)) :
   rien de ce qui a été saisi depuis le déploiement n'est perdu. Le
   déploiement sort tout de même en échec : le job est rouge.

Une révision qui a échoué est mémorisée, et `deploy.sh` lancé à la main ne la
rejoue pas sans `--force`. GitHub, lui, passe toujours `--force` : relancer un
job, c'est demander à réessayer.

## Ce qui ne se met pas à jour tout seul

L'agent et son accès. Un script qui se réécrit pendant qu'il s'exécute est une
source de pannes difficiles à lire ; la dérive est donc **signalée dans le
journal**, et se corrige par un `install.sh` à la main.

La règle est simple : changer la pile ou le routage part tout seul, changer
l'agent demande une intervention.

## Le VPS n'est pas dédié

Le projet `mairie` tourne sur la même machine et occupe 80, 443, 3000 et 5432.
Un bind sur `0.0.0.0` occupe le port sur **toutes** les interfaces, loopback
compris : ce n'est donc pas une question de sécurité mais de disponibilité.

Règle retenue : **seul le proxy de tête écoute sur une interface publique.**
Tout le reste est sur loopback, joignable par le proxy ou par tunnel SSH.

| Service | Port hôte |
| --- | --- |
| API | `127.0.0.1:3001` |
| Tableau de bord | `127.0.0.1:4200` |
| Portfolio | `127.0.0.1:4201` |
| PostgreSQL | `127.0.0.1:5433` |
| Caddy interne | `127.0.0.1:8080` — débogage seulement |
| Authentik | `127.0.0.1:9000` |
| API du staging | `127.0.0.1:3101` — sonde de santé de `deploy-staging.sh` |

Le proxy de tête est `caddy-edge`, neutre et commun à tous les projets de la
machine ([ADR 0025](../../docs/adr/0025-un-proxy-de-tete-neutre-devant-les-projets.md),
[`infra/edge/`](../edge)). Il détient 80 et 443, termine TLS derrière un
certificat **joker**, et transmet **tout le domaine** au Caddy interne de
Personal OS — qui décide ensuite quoi en faire.

C'est la propriété qui compte : ajouter un sous-domaine se fait dans le
`Caddyfile` de ce dépôt, versionné et déployé par l'agent, sans toucher au
proxy de tête ni à aucun autre projet.

> **L'edge joint le Caddy interne par son nom de conteneur**, sur le réseau
> Docker `edge` — pas par le port publié. Un conteneur ne peut pas atteindre un
> port publié sur `127.0.0.1` : c'est le loopback de l'hôte, pas le sien. Le
> port de la table ci-dessus ne sert qu'à déboguer depuis l'hôte, avec un
> en-tête `Host` explicite.

À la migration vers le homelab, le Caddy interne reprendra TLS — on change les
adresses de site, pas l'architecture.

Le tableau de bord **est** routé publiquement depuis #5 : il a désormais une
authentification propre — session serveur émise par l'API, garde globale sur
tous les endpoints ([ADR 0015](../../docs/adr/0015-authentik-des-le-vps-avec-session-serveur.md),
[ADR 0026](../../docs/adr/0026-session-en-base-et-api-fermee-par-defaut.md)).
Authentik l'accompagne, sur son propre hôte.

> **`DASHBOARD_HOST` et `AUTHENTIK_HOST` ne sont plus facultatifs.** Leurs blocs
> sont chargés par le glob `conf.d/*.caddy`, et un nom vide donne une adresse de
> site que Caddy refuse : le proxy interne ne démarre alors pas du tout, et le
> portfolio tombe avec lui.
>
> Le compose les exige donc explicitement (`:?`), au même titre que
> `PORTFOLIO_HOST`. Sans cette exigence, l'oubli passerait l'interpolation, le
> déploiement serait déclaré **réussi** — la sonde de santé n'interroge que
> l'API, sur son port loopback — et le site serait hors ligne sans qu'aucun
> retour arrière ne se déclenche.
>
> Le fichier `caddy/conf.d/dashboard.caddy.desactive` posé par la tranche
> précédente reste sur la machine — l'agent copie, il ne synchronise pas. Il est
> inerte (le glob ne le prend pas), mais autant le supprimer une fois :
> `sudo rm /opt/personal-os/caddy/conf.d/dashboard.caddy.desactive`.

## Ce qui ne peut pas être automatisé

Plusieurs gestes demandent une intervention humaine.

### 1. DNS

Un enregistrement `A` vers l'IP du VPS pour chacun des trois hôtes — portfolio,
tableau de bord, Authentik — et pour les deux du staging (`staging`,
`staging-portfolio`), à moins qu'un enregistrement joker ne les couvre déjà. Baisser le TTL avant toute bascule ultérieure,
sinon un retour arrière prend la durée du cache.

Le certificat, lui, est déjà là : le proxy de tête détient un joker
`*.<domaine>` ([ADR 0025](../../docs/adr/0025-un-proxy-de-tete-neutre-devant-les-projets.md)),
il n'y a rien à demander pour un sous-domaine de plus.

### 2. Visibilité des images sur GHCR

Les paquets publiés depuis un dépôt public sont **privés par défaut**. Deux
chemins :

- les rendre publics (Package settings → Change visibility). La machine n'a
  alors besoin d'aucun identifiant, et il n'y en a donc aucun à faire fuir ;
- les laisser privés, et poser un jeton `read:packages` **sans aucun droit sur
  le dépôt** dans `/etc/personal-os/ghcr.env`.

### 3. Le proxy de tête

Il s'installe une fois, et se documente chez lui : [`infra/edge/`](../edge).

Ce qu'il faut en retenir ici : l'edge doit être **démarré avant** cette pile,
parce que c'est lui qui crée le réseau Docker `edge` que le compose de
production déclare en réseau externe. Dans l'autre ordre, le déploiement
s'arrête sur un message clair — plutôt que de créer en silence un second réseau
du même nom où personne ne se parle.

Une fois l'edge en place, il n'y a plus rien à y faire : il transmet tout le
domaine, et les hôtes se déclarent dans le `Caddyfile` de ce dépôt.

### 4. Pose des secrets et première installation

```bash
sudo git clone https://github.com/MaximeD1412/personal-os.git /opt/personal-os/src
sudo /opt/personal-os/src/infra/deploy/bin/install.sh

# renseigner, puis relire :
sudo -e /opt/personal-os/.env        # mot de passe de la base, hôtes, ports
sudo -e /etc/personal-os/deploy.conf # registre, URL de santé, alertes
sudo -e /etc/personal-os/ghcr.env    # seulement si les images sont privées

sudo /opt/personal-os/deploy/bin/deploy.sh --dry-run   # relire le plan
```

Tant que les clés de GitHub ne sont pas posées (§ suivant), rien ne se déploie
tout seul : les jobs de déploiement échouent sur un refus d'authentification.

> **La sauvegarde doit être installée avant.** L'agent refuse de démarrer sans
> `restore.sh` : la répétition n'est pas une option qu'on désactive quand elle
> gêne, et sans elle une migration fautive serait découverte sur les données
> réelles.

> **`POSTGRES_PASSWORD` n'est lu qu'à la création du volume.** Le changer sur
> une base déjà initialisée ne change rien côté serveur, mais l'API construira
> sa chaîne de connexion avec la nouvelle valeur et ne se connectera plus.
>
> Le mot de passe d'Authentik (`AUTHENTIK_POSTGRES_PASSWORD`) ne suit **pas**
> cette règle : le service `db-init` le réapplique par `ALTER ROLE` à chaque
> déploiement. Le changer dans `.env` suffit à le changer en base.

### 4 bis. Les clés de GitHub et ses environnements

Une paire de clés **par environnement**, générée sur un poste de confiance,
jamais sur le VPS ni dans un dépôt :

```bash
ssh-keygen -t ed25519 -N '' -C personal-os-deploy-prod    -f prod
ssh-keygen -t ed25519 -N '' -C personal-os-deploy-staging -f staging
```

**Sur le VPS**, les deux clés publiques, puis `install.sh` qui réécrit
`authorized_keys` à partir d'elles :

```bash
sudo install -m 644 prod.pub staging.pub /etc/personal-os/deploy-keys/
sudo /opt/personal-os/src/infra/deploy/bin/install.sh
sudo cat /home/deploy/.ssh/authorized_keys   # deux lignes, chacune forcée
```

`install-access.sh` refuse un fichier qui contient autre chose qu'une clé
publique nue (une clé privée, des options, deux clés), et la même clé pour les
deux environnements.

**Dans GitHub** (*Settings → Environments*) :

| Environnement | Règle de déploiement | Secret | Variables |
| --- | --- | --- | --- |
| `staging` | branche `develop` | `STAGING_SSH_KEY` : la clé privée `staging` | `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS` |
| `production` | branche `main` seulement | `PROD_SSH_KEY` : la clé privée `prod` | `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS` |

- `DEPLOY_HOST` : le nom ou l'IP du VPS, tel que le runner s'y connecte.
- `DEPLOY_KNOWN_HOSTS` : l'empreinte **épinglée** de l'hôte, une ligne
  `known_hosts`. Le job refuse une machine qui ne la présente pas, il ne
  l'ajoute jamais (`StrictHostKeyChecking=yes`). La relever, et la comparer à
  celle que la machine affiche elle-même :

  ```bash
  ssh-keyscan -t ed25519 <DEPLOY_HOST>                       # depuis un poste
  sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub      # sur le VPS
  ssh-keygen -lf <(ssh-keyscan -t ed25519 <DEPLOY_HOST>)     # même empreinte ?
  ```

Le port SSH doit être joignable depuis les runners GitHub : leurs plages
d'adresses sont trop larges pour un filtrage par pare-feu, le contrôle repose
sur la clé et la commande forcée (ADR 0032).

Une fois les deux clés posées, supprimer les clés privées du poste : elles ne
vivent plus que dans GitHub.

### 4 ter. Rotation d'une clé

Changer la clé d'un environnement, par exemple après un doute sur un secret
GitHub :

1. générer une nouvelle paire (`ssh-keygen` ci-dessus) ;
2. remplacer `/etc/personal-os/deploy-keys/<env>.pub` et relancer
   `install.sh` : `authorized_keys` est réécrit en entier, l'ancienne clé ne
   passe **plus** dès cet instant ;
3. remplacer le secret (`STAGING_SSH_KEY` ou `PROD_SSH_KEY`) dans
   l'environnement GitHub, puis relancer le dernier job de déploiement pour
   vérifier ;
4. supprimer la clé privée du poste.

Entre 2 et 3, un déploiement de cet environnement échoue sur un refus
d'authentification : la production reste sur sa version, rien ne casse. Retirer
un `.pub` et relancer `install.sh` coupe l'accès de cet environnement.

Changer la clé d'hôte du VPS (réinstallation) oblige à mettre à jour
`DEPLOY_KNOWN_HOSTS` dans les deux environnements.

### 5. Authentik : le client OIDC et les deux comptes

C'est la part proprement humaine de [#5](https://github.com/MaximeD1412/personal-os/issues/5) :
elle touche des secrets et une interface d'administration, et rien ne l'automatise.

Le rôle et la base PostgreSQL, eux, se créent tout seuls (`db-init`,
[ADR 0027](../../docs/adr/0027-un-seul-postgresql-pour-l-application-et-authentik.md)) :
il n'y a **aucune** commande `psql` à passer.

1. **Premier démarrage.** Poser `AUTHENTIK_SECRET_KEY` et
   `AUTHENTIK_POSTGRES_PASSWORD` dans `/opt/personal-os/.env`, puis laisser
   l'agent déployer. Authentik migre sa base tout seul — c'est long la première
   fois.
2. **Compte d'administration.** Ouvrir `https://<AUTHENTIK_HOST>/if/flow/initial-setup/`.
   Cette page ne s'ouvre qu'une fois, tant qu'aucun administrateur n'existe.
3. **Les deux comptes du foyer.** *Directory → Users → Create*. Renseigner
   l'adresse : c'est elle, et elle seule, qui décide de l'admission côté
   Personal OS.
4. **Le fournisseur OIDC.** *Applications → Providers → Create → OAuth2/OpenID
   Provider* :
   - **Client type** : `Confidential`. L'API est un serveur, elle garde un
     secret. `Public` supprimerait le secret et l'authentification du client.
   - **Redirect URI** : exactement la valeur de `OIDC_REDIRECT_URI`, en
     correspondance `Strict`. Un écart d'une barre oblique fait refuser le
     retour, sans autre explication qu'un « invalid redirect ».
   - **Scopes** : `openid`, `email`, `profile`. Sans `email`, l'API n'a pas de
     quoi admettre qui que ce soit et refuse tout le monde.
   - **Signing key** : le certificat auto-signé d'Authentik convient. L'API
     vérifie la signature contre le jeu de clés publié, pas contre une autorité.
5. **L'application.** *Applications → Create*, rattachée au fournisseur. Le
   **slug** devient `OIDC_CLIENT_ID` et se retrouve dans l'émetteur :
   `https://<AUTHENTIK_HOST>/application/o/<slug>/`.
6. **Les liaisons.** *Application → Policy/Group/User Bindings* : rattacher les
   deux comptes. Sans liaison, Authentik les refuse avant même que Personal OS
   n'ait son mot à dire.
7. **Reporter dans `/opt/personal-os/.env`** : `OIDC_ISSUER`, `OIDC_CLIENT_ID`,
   `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`, `DASHBOARD_URL`,
   `AUTH_ALLOWED_EMAILS`.

L'émetteur se vérifie sans se connecter :

```bash
curl -s https://<AUTHENTIK_HOST>/application/o/<slug>/.well-known/openid-configuration | jq .issuer
```

La chaîne rendue doit être **identique** à `OIDC_ISSUER`, barre finale comprise :
c'est elle que porte le `iss` des jetons, et la comparaison y est littérale.
L'API refuse de démarrer un flux si les deux divergent, avec un message qui le
dit — plutôt que d'échouer plus loin sur une signature.

> **Ce nom d'hôte s'arrête une fois.** L'émetteur en dépend, et en changer après
> coup oblige à refaire le client OIDC et à reconfigurer l'API.

### 5. La clé de l'API Claude

L'API refuse de démarrer en production sans `AI_PROVIDER=claude` : le double de
test (`factice`) n'y est pas admis, et le staging le garde.

1. Dans la console Anthropic, créer une clé **dédiée** à Personal OS, dans un
   espace de travail qui porte sa propre **limite de dépense** mensuelle. C'est
   le filet sous le plafond applicatif, qui n'est qu'une estimation.
2. Reporter dans `/opt/personal-os/.env` : `AI_PROVIDER=claude`,
   `ANTHROPIC_API_KEY`, `AI_MODEL`, le tarif du modèle en centimes par million
   de jetons (`AI_PRICE_INPUT_PER_MTOK_CENTS`, `AI_PRICE_OUTPUT_PER_MTOK_CENTS` :
   200 et 1000 pour `claude-sonnet-5-5`, à vérifier sur la grille du jour) et
   `AI_MONTHLY_BUDGET_CENTS`.

Changer de modèle, c'est changer son tarif dans le même geste : sans quoi le
plafond se calcule sur le prix d'un autre.

### 6. Le stockage objet OVH

Les fichiers téléversés (le CV du portfolio) vivent dans un bucket OVH Object
Storage, hors de la base et hors du VPS. L'API refuse de démarrer en production
sans `STORAGE_PROVIDER=s3`.

1. Dans le projet Public Cloud OVH, créer un bucket **Object Storage** (API S3,
   classe Standard), privé, dans la région la plus proche du VPS.
2. Créer un **utilisateur S3** dédié à Personal OS, puis lui importer une
   politique qui ne lui ouvre **que ce bucket** (`s3:GetObject`,
   `s3:PutObject`, `s3:DeleteObject` sur `arn:aws:s3:::<bucket>/*`,
   `s3:ListBucket` sur `arn:aws:s3:::<bucket>`). Une clé fuitée n'atteint alors
   rien d'autre du projet.
3. Reporter dans `/opt/personal-os/.env` : `STORAGE_PROVIDER=s3`, `S3_ENDPOINT`
   (celui de la région, `https://s3.<region>.io.cloud.ovh.net`), `S3_REGION`,
   `S3_BUCKET`, `S3_ACCESS_KEY_ID` et `S3_SECRET_ACCESS_KEY`.
4. Vérifier que la sauvegarde emporte le bucket : `S3_MIRROR_*` dans la
   configuration de Restic, puis `backup.sh --dry-run`
   ([`infra/backup`](../backup/README.md)).

## Exploitation courante

```bash
tail -n 100 /var/log/personal-os/deploy-trigger-prod.log     # dernier déploiement poussé de la prod
tail -n 100 /var/log/personal-os/deploy-trigger-staging.log  # … du staging
cat /var/log/personal-os/deploy.log              # ce qui a été déployé, et quand
cat /var/lib/personal-os/deploy-state            # ce qui tourne, et vers quoi reculer

sudo /opt/personal-os/deploy/bin/deploy.sh                 # appliquer le canal `main` à la main
sudo /opt/personal-os/deploy/bin/deploy.sh <commit>        # un commit précis
sudo /opt/personal-os/deploy/bin/deploy.sh --force         # réessayer une révision refusée
sudo /opt/personal-os/deploy/bin/deploy.sh --rollback      # reculer à la main
```

Le job GitHub et `deploy-trigger-<env>.log` disent *comment* s'est passé le
dernier déploiement poussé (le journal est réécrit à chaque déploiement) ;
`deploy.log` dit *ce qui a été déployé et quand*, et garde tout l'historique.

Le plus simple pour réessayer reste de **relancer le job** dans GitHub.

## Signalement

- **Le job GitHub** est rouge si le déploiement échoue, s'il finit par un
  retour arrière, ou si le VPS est injoignable. C'est le signal principal, et
  il couvre ce que l'ancien minuteur ne disait pas : un déploiement qui n'a
  jamais démarré.
- **Le courriel** (`DEPLOY_ALERT_EMAIL`) : `deploy-trigger` appelle
  `notify-failure.sh` sur tout déploiement en échec, prod ou staging, avec les
  50 dernières lignes du journal. Il sert à qui ne regarde pas GitHub, et
  dépend d'un relais SMTP.
- **Le témoin d'inactivité** (`DEPLOY_HEARTBEAT_URL`), facultatif, reste pingé
  par `deploy.sh` au début, au succès et en échec de chaque déploiement de la
  prod. Il n'y a plus de passage périodique : sa période doit être celle des
  livraisons, ou il faut le retirer.

## Le staging de démonstration

Un second projet Compose sur le même VPS, qui sert les **mêmes images** que la
prod avec des **données de démo seulement**
([ADR 0031](../../docs/adr/0031-un-staging-de-demonstration-sur-le-meme-vps.md)). On y
montre le produit, on y essaie un commit de `develop` ; on n'y saisit rien qui
compte : chaque déploiement le remet au jeu de démo.

Chaque push sur `develop` le déploie, par le job `staging` de la CI et la clé
du staging. À la main :

```bash
sudo /opt/personal-os/deploy/bin/deploy-staging.sh <commit> --dry-run  # relire le plan
sudo /opt/personal-os/deploy/bin/deploy-staging.sh <commit>
```

1. **La pile** est reprise du commit, depuis le clone du staging
   (`/opt/personal-os-staging/src`) : celui de la prod ne bouge pas.
2. **Les images** du commit sont tirées : elles doivent avoir été publiées.
3. **La base du staging** démarre, et les services applicatifs du staging
   s'arrêtent, pour que les commandes qui suivent tiennent sous le plafond
   total. Puis trois commandes passent dans l'image
   `api`, avec l'environnement du staging : la vérification de l'environnement
   (`node verifier-environnement.js`, les garde-fous du démarrage de l'API), la
   migration, puis le semis (`node demo-seed.js`, c'est-à-dire
   `pnpm demo:seed`), qui vide les données métier et sème les trois Espaces.
4. **Le redémarrage**, puis la santé sur `127.0.0.1:3101`. Si elle échoue, le
   script s'arrête : pas de retour arrière, il n'y a rien à préserver.

Pas de répétition sur une restauration non plus : le staging n'a ni sauvegarde
ni donnée réelle. Le journal vit dans `/var/log/personal-os/deploy-staging.log`.

### Ce qui est partagé, et ce qui ne l'est pas

| Partagé | À lui seul |
| --- | --- |
| Le proxy de tête et son certificat joker | Le projet `personal-os-staging` et ses conteneurs |
| Le Caddy interne de la prod (`caddy/conf.d/staging.caddy`) | Son PostgreSQL et son volume (`staging-db-data`) |
| Le réseau `personal-os-staging-edge`, entre ce Caddy et ses deux fronts | Son réseau par défaut : ni la base ni l'API de la prod n'y sont |
| L'Authentik de la prod : un forward auth devant chaque hôte, et un client OIDC **dédié** | Son environnement (`/opt/personal-os-staging/.env`) et ses secrets |

Le Caddy de la prod rejoint `personal-os-staging-edge`, et les deux fronts du
staging y portent des noms à eux (`staging-dashboard`, `staging-portfolio`) :
sous les noms de la prod, Docker les résoudrait **à côté** de ceux de la prod,
et une partie du trafic de la prod partirait vers le staging.

### Les garde-fous

- **Rien du staging ne répond sans session Authentik**, pas même son
  portfolio : le Caddy interne passe chacun de ses deux hôtes par le forward
  auth de l'outpost intégré d'Authentik avant de les servir. Le portfolio de
  la prod reste public.
- **L'API de staging refuse de démarrer** sur la base de la prod : sa
  `DATABASE_URL` ne doit désigner aucun hôte de `PROD_DATABASE_HOST`, et doit
  nommer un seul hôte, en clair, sans `host`, `hostaddr` ni `port` en
  paramètre. L'image fait cette vérification avant sa migration de démarrage. Elle
  refuse aussi tout `APP_ENV` autre que `development`, `staging` ou
  `production`.
- **La vérification passe avant la migration et le semis**, qui ne démarrent
  pas l'API et contourneraient sinon ce refus. C'est le semis qui vide la base.
- **`deploy-staging.sh` refuse** un projet, une pile, un environnement ou un
  clone qui seraient ceux de la prod, et un environnement qui ne pose pas
  `APP_ENV=staging`.
- **Compose ne voit que l'environnement du staging** : le script ne lui
  transmet aucune variable du shell appelant, qui passerait sinon devant celles
  de `--env-file`.

### Plafonds et arrêt

1 CPU et 1 Go **au total** : base 0,30 CPU / 320 Mo, API 0,40 / 448 Mo, chaque
front 0,15 / 128 Mo. Pendant un déploiement, seule la base tourne à côté du
conteneur jetable de chaque commande. Le VPS est celui de la prod, et le staging ne doit jamais
l'affamer.

```bash
docker stats --no-stream $(docker ps -q --filter label=com.docker.compose.project=personal-os-staging)
sudo docker compose --project-name personal-os-staging stop   # l'arrêter
```

Arrêté, le staging répond 502 sous ses deux hôtes : le Caddy interne résout
ses amonts à chaque requête, et la prod n'en est pas affectée. Un
`deploy-staging.sh` le relance.

### L'installer

`install.sh` pose `/opt/personal-os-staging` (pile, modèle d'environnement,
clone) et crée le réseau `personal-os-staging-edge`, que la pile de la prod
exige **même quand le staging est arrêté**. Il reste à renseigner :

- `/opt/personal-os-staging/.env`, à partir de `staging.env.example` : un mot de
  passe de base à lui, et les adresses de la base de la prod dans
  `PROD_DATABASE_HOST` ;
- dans `/opt/personal-os/.env` : `STAGING_DASHBOARD_HOST` et
  `STAGING_PORTFOLIO_HOST` ;
- dans Authentik, un client OIDC à part (même marche que le §5 ci-dessus),
  d'URI de redirection `https://staging.<domaine>/api/auth/callback`, lié aux
  deux comptes du foyer ;
- dans Authentik encore, un fournisseur **Proxy** en mode « Forward auth
  (single application) » par hôte du staging (`https://staging.<domaine>`,
  `https://staging-portfolio.<domaine>`), chacun dans une application liée aux
  deux comptes et ajoutée à l'outpost intégré. Sans eux, les deux hôtes
  répondent par une erreur d'Authentik : fermés, jamais ouverts.

## Tests

```bash
pnpm exec nx run deploy:test              # plan, garde-fous, refus — sans infrastructure
pnpm exec nx run deploy:test-integration  # chaîne complète — exige docker, restic et git
```

La campagne du staging (`deploy-staging.integration-spec.ts`) déploie le
**vrai** `docker-compose.staging.yml` à côté d'un projet qui tient le rôle de la
prod. Elle vérifie que les conteneurs de celui-ci n'ont pas bougé (mêmes
identifiants, même démarrage), que la base ne contient que le jeu de démo après
chaque déploiement, que Docker applique les plafonds du fichier, que seuls les
deux fronts rejoignent le réseau partagé, et qu'un environnement qui désigne la
base de la prod arrête tout avant la migration.

Cette campagne porte `"parallelism": false`, comme celle de la sauvegarde. Les
deux nettoient les conteneurs jetables par le préfixe `personal-os-restore-`,
que `restore.sh` leur donne à toutes les deux : lancées côte à côte, l'une
détruit la restauration que l'autre est en train d'interroger. La panne est
intermittente, et son message ne parle jamais de conteneurs.

La campagne de l'accès (`deploy-trigger.integration-spec.ts`) lance le **vrai**
`install.sh` dans un conteneur systemd jetable, avec un vrai sshd et un vrai
sudo, sur une machine où l'ancien minuteur est armé. Elle vérifie que le
minuteur a disparu, que `deploy` n'a ni mot de passe ni groupe `docker`, que
`sudo` ne lui ouvre que `deploy-trigger`, puis, par SSH : les refus (`ls`,
session sans commande, autre environnement, commit invalide, clé inconnue,
redirection de port), les déploiements acceptés en root, le code de sortie et
le courriel d'un échec, la file d'attente par environnement, un déploiement qui
survit à une connexion coupée, et la rotation d'une clé.

La campagne d'intégration monte un **vrai** registre local, y pousse des images
étiquetées, crée un dépôt Git avec de vrais commits, sauvegarde une base réelle,
puis exerce trois chemins : la détection du canal, l'arrêt sur répétition
échouée, et le retour arrière sur santé échouée. Elle vérifie enfin que la base
a gardé la ligne saisie entre les deux versions — c'est l'ADR 0024 rendue
observable, et c'est précisément ce qu'aucune simulation ne prouverait.
