# Déploiement tiré par le VPS

Un commit atteignant la branche principale part en production
([ADR 0023](../../docs/adr/0023-deploiement-automatique-tire-par-le-vps.md)).
La branche principale est une branche de **livraison** : fusionner signifie
livrer.

| Fichier | Rôle |
| --- | --- |
| `bin/deploy.sh` | La séquence complète : répétition, migration, redémarrage, santé, retour arrière |
| `bin/notify-failure.sh` | Courriel + témoin d'inactivité, appelé par `OnFailure=` |
| `bin/install.sh` | Pose l'agent, la pile, les unités systemd. Idempotent |
| `docker-compose.prod.yml` | La pile de production. Ne construit rien : elle tire des images |
| `caddy/` | Carte de routage de Personal OS — portfolio, tableau de bord, Authentik |
| `deploy.conf.example` | Configuration de l'agent. **Sans secret** |
| `ghcr.env.example` | Modèle de jeton de lecture du registre. Jamais dans Git |
| `stack.env.example` | Modèle d'environnement de la pile. Jamais dans Git |

## Le sens de circulation

GitHub Actions construit, teste et pousse sur GHCR, puis **s'arrête**. Il n'a
aucun accès entrant au VPS : ni clé SSH, ni secret de production, rien qui
permette d'atteindre la machine qui héberge fiches de paie, finances et
documents immobiliers.

Le seul identifiant qui circule va dans l'autre sens — un jeton `read:packages`
posé sur la machine, et encore : seulement si les images sont privées.

```
   fusion sur main
         │
         ▼
   GitHub Actions ──▶ GHCR : api, dashboard, portfolio en <commit>
         ╵                              │  (+ edge, tiré à la main)
         ╵ (rien ne repart vers le VPS) │  canal `main` déplacé,
         ╵                              │  une fois toutes poussées
                                        ▼
                          VPS ── timer, toutes les 2 min
                                        │
                                        ▼
                          répétition ▸ migration ▸ santé ▸ (retour arrière)
```

## La séquence

1. **Détection.** L'agent lit le libellé `org.opencontainers.image.revision` de
   `api:main` — quelques kilo-octets de manifeste, pas une image. C'est un
   **commit** qu'il en tire, jamais un tag mouvant : un tag désignerait autre
   chose demain, et le retour arrière n'aurait plus de cible.
2. **Répétition.** La dernière sauvegarde est restaurée dans un conteneur
   jetable, et la migration y est rejouée
   ([ADR 0021](../../docs/adr/0021-pas-de-staging-la-restauration-sert-de-banc-d-essai.md)).
   Si elle échoue, tout s'arrête : la production n'a pas bougé, les images ne
   sont même pas récupérées. Ce geste teste la migration **et** la sauvegarde.
3. **Reprise de la pile.** Le compose et le routage sont repris du dépôt à la
   révision déployée. Sans ça, une livraison qui ajoute un service publierait
   ses images sans la configuration qui les branche.
4. **Migration réelle**, puis redémarrage sur les nouvelles images.
5. **Santé.** Si l'API ne répond pas, les **images précédentes** reviennent. La
   base n'est jamais touchée
   ([ADR 0024](../../docs/adr/0024-migrations-toujours-compatibles-avec-la-version-precedente.md)) :
   rien de ce qui a été saisi depuis le déploiement n'est perdu.

Une révision qui a échoué est mémorisée et n'est pas rejouée. Sans cette
mémoire, le timer remettrait la production à l'épreuve toutes les deux minutes
avec la même version cassée, et noierait le signalement sous ses propres
alertes.

## Ce qui ne se met pas à jour tout seul

L'agent et ses unités systemd. Un script qui se réécrit pendant qu'il s'exécute
est une source de pannes difficiles à lire ; la dérive est donc **signalée dans
le journal**, et se corrige par un `install.sh` à la main.

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
> Le fichier `caddy/conf.d/dashboard.caddy.desactive` posé par la tranche
> précédente reste sur la machine — l'agent copie, il ne synchronise pas. Il est
> inerte (le glob ne le prend pas), mais autant le supprimer une fois :
> `sudo rm /opt/personal-os/caddy/conf.d/dashboard.caddy.desactive`.

## Ce qui ne peut pas être automatisé

Cinq gestes demandent une intervention humaine.

### 1. DNS

Un enregistrement `A` vers l'IP du VPS pour chacun des trois hôtes — portfolio,
tableau de bord, Authentik. Baisser le TTL avant toute bascule ultérieure,
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

## Exploitation courante

```bash
systemctl list-timers personal-os-deploy.timer   # prochaine surveillance
journalctl -u personal-os-deploy.service -n 100  # dernier déploiement
cat /var/log/personal-os/deploy.log              # ce qui a été déployé, et quand
cat /var/lib/personal-os/deploy-state            # ce qui tourne, et vers quoi reculer

/opt/personal-os/deploy/bin/deploy.sh --force     # réessayer une révision refusée
/opt/personal-os/deploy/bin/deploy.sh --rollback  # reculer à la main
```

Le journal systemd dit *comment* s'est passé le dernier déploiement ;
`deploy.log` dit *ce qui a été déployé et quand*, et survit à la rotation du
journal.

## Signalement

Deux canaux, parce qu'ils tombent en panne différemment — et parce que le
résultat d'un déploiement **n'apparaît pas dans l'interface GitHub**.

- **`OnFailure=` systemd** envoie un courriel avec les 50 dernières lignes du
  journal. Il dit *pourquoi*, mais dépend d'un relais SMTP.
- **Témoin d'inactivité** (`DEPLOY_HEARTBEAT_URL`) : il dit seulement *que*
  quelque chose ne va pas, mais c'est le seul à détecter le mode de panne
  dangereux — l'agent qui **ne tourne plus du tout**. Un `OnFailure` ne se
  déclenche que si l'unité s'exécute.

## Tests

```bash
pnpm exec nx run deploy:test              # plan, garde-fous, refus — sans infrastructure
pnpm exec nx run deploy:test-integration  # chaîne complète — exige docker, restic et git
```

Cette campagne porte `"parallelism": false`, comme celle de la sauvegarde. Les
deux nettoient les conteneurs jetables par le préfixe `personal-os-restore-`,
que `restore.sh` leur donne à toutes les deux : lancées côte à côte, l'une
détruit la restauration que l'autre est en train d'interroger. La panne est
intermittente, et son message ne parle jamais de conteneurs.

La campagne d'intégration monte un **vrai** registre local, y pousse des images
étiquetées, crée un dépôt Git avec de vrais commits, sauvegarde une base réelle,
puis exerce trois chemins : la détection du canal, l'arrêt sur répétition
échouée, et le retour arrière sur santé échouée. Elle vérifie enfin que la base
a gardé la ligne saisie entre les deux versions — c'est l'ADR 0024 rendue
observable, et c'est précisément ce qu'aucune simulation ne prouverait.
