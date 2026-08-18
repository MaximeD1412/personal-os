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
| `caddy/` | Carte de routage de Personal OS |
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
         ╵                              │
         ╵ (rien ne repart vers le VPS) │  canal `main` déplacé,
         ╵                              │  une fois les trois poussées
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
| Caddy interne | `127.0.0.1:8080` |
| Authentik (#5) | `127.0.0.1:9000` — réservé |

Le proxy de tête (`mairie-caddy-1`) termine TLS et transmet à `127.0.0.1:8080`.
Le Caddy interne de Personal OS ne termine pas TLS : son intérêt est que la
carte de routage vive dans **ce dépôt**, versionnée et déployée par l'agent,
plutôt que dans la configuration d'un autre projet. À la migration vers le
homelab, c'est ce conteneur qui reprendra TLS — on change les adresses de site,
pas l'architecture.

Le tableau de bord n'est **pas** routé publiquement : il n'aura
d'authentification qu'avec Authentik ([#5](https://github.com/MaximeD1412/personal-os/issues/5),
[ADR 0015](../../docs/adr/0015-authentik-des-le-vps-avec-session-serveur.md)).
D'ici là il reste joignable par tunnel SSH, et le bloc Caddy tout prêt attend
dans `caddy/conf.d/dashboard.caddy.desactive`.

## Ce qui ne peut pas être automatisé

Quatre gestes demandent une intervention humaine.

### 1. DNS

Un enregistrement `A` vers l'IP du VPS pour l'hôte du portfolio. Baisser le TTL
avant toute bascule ultérieure, sinon un retour arrière prend la durée du cache.

### 2. Visibilité des images sur GHCR

Les paquets publiés depuis un dépôt public sont **privés par défaut**. Deux
chemins :

- les rendre publics (Package settings → Change visibility). La machine n'a
  alors besoin d'aucun identifiant, et il n'y en a donc aucun à faire fuir ;
- les laisser privés, et poser un jeton `read:packages` **sans aucun droit sur
  le dépôt** dans `/etc/personal-os/ghcr.env`.

### 3. Le proxy de tête

Ajouter au Caddyfile de `mairie` un bloc qui transmet l'hôte de Personal OS au
Caddy interne, en conservant l'en-tête `Host` — sans lui, aucun bloc ne
correspond de l'autre côté :

```caddyfile
portfolio.exemple.fr {
	reverse_proxy 127.0.0.1:8080
}
```

C'est le seul endroit où la configuration de Personal OS touche celle d'un autre
projet, et c'est une ligne par hôte.

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
