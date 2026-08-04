# Migration du VPS OVH vers le homelab

> Note vivante — dernière mise à jour : 4 août 2026.
> Ce n'est ni un plan daté ni une décision : c'est la liste des pièges connus,
> à relire **avant** de commencer la migration. Chaque tranche qui découvre une
> contrainte transposable au homelab l'ajoute ici plutôt que de la laisser dans
> une PR fermée.

Le cadre est posé au §14 de la note produit : la migration ne doit pas exiger de
réécriture applicative. Elle change des endpoints, des chemins et du DNS — pas du
code. Ce document recense ce qui ne se déduit pas de cette phrase.

## Secrets : ne jamais recopier, toujours ajouter puis révoquer

C'est le point le plus contre-intuitif de la migration, et le plus coûteux à
rater.

### Clé Restic

Le dépôt Restic est indexé par son mot de passe. En générer un nouveau sur le
homelab ne « refait pas les sauvegardes » : ça crée un **dépôt vide**, et tout
l'historique de l'OVH devient inaccessible.

Recopier le mot de passe d'une machine à l'autre marche, mais ne révoque rien :
une fois le VPS déclassé, son secret reste valide sur une machine que tu ne
contrôles plus. Restic accepte **plusieurs clés par dépôt** — c'est le bon geste :

```bash
# depuis le homelab, en s'authentifiant avec la clé actuelle
restic key add            # demande le mot de passe existant, puis en crée un nouveau
restic key list           # une clé par machine

# une fois le VPS déclassé, et seulement à ce moment-là
restic key remove <id-de-la-clé-du-vps>
```

Le nouveau mot de passe est généré **sur le homelab** et n'en sort pas, comme sur
le VPS ([ADR 0020](adr/0020-sauvegardes-restic-chez-un-autre-fournisseur.md)).

**Ce geste suppose que le VPS est encore vivant.** S'il meurt avant la migration,
le seul chemin de retour est la copie papier de la clé, hors ligne. C'est
exactement le scénario qu'elle couvre — vérifier qu'elle existe et qu'elle est
lisible fait partie de la préparation, pas de la réaction.

### Identifiants Backblaze

Même logique : créer une **seconde clé applicative** restreinte au bucket pour le
homelab, et supprimer celle du VPS au déclassement. Ne pas recopier.

### Base Authentik

Piège silencieux, et le plus douloureux à rattraper. L'API relie sa table `User`
locale au **sujet Authentik** ([ADR 0015](adr/0015-authentik-des-le-vps-avec-session-serveur.md)).
Recréer les comptes à la main sur le nouvel Authentik génère de **nouveaux
sujets** : les utilisateurs sont formellement les mêmes, mais plus aucune donnée
ne leur est rattachée.

La base Authentik se **restaure**, elle ne se rejoue pas. Elle est dans le
périmètre de sauvegarde précisément pour ça.

Ce qui change en revanche, et doit être repris à la main :

- l'**issuer URL** et les URI de redirection OIDC, côté Authentik et côté API ;
- les sessions serveur en cours, toutes invalidées — reconnexion pour tout le
  monde, sans conséquence puisqu'il y a deux comptes.

## Données

| Quoi | Geste | Piège |
| --- | --- | --- |
| PostgreSQL | Restauration d'un instantané Restic | Vérifier la version majeure : Postgres 18 monte son volume sur `/var/lib/postgresql`, pas sur `/data` |
| Objets S3 | Recopie vers Garage | L'endpoint et le style d'URL changent ; le *path-style* est souvent requis là où OVH acceptait le *virtual-host* |
| Base Authentik | Restauration, jamais recréation | Voir ci-dessus |

La bascule du stockage objet vers Garage est la seule qui touche de la
configuration applicative — d'où l'exigence du §24.6 : API S3 standard,
configuration par variables, jamais de chemin en dur.

## Sauvegardes : le périmètre change, pas la règle

La liste des cibles Restic est propre à la machine — volumes Docker, chemins,
bases. C'est la raison pour laquelle le script de sauvegarde lit ses cibles
depuis un **fichier de configuration** : sur le homelab, on change ce fichier,
pas le script.

La règle du fournisseur tiers, elle, ne se relâche pas — elle devient plus
importante. Un homelab qui se sauvegarde lui-même ne protège de rien : incendie,
vol et dégât des eaux emportent la production et la sauvegarde d'un seul coup.
Backblaze reste la destination hors-site. C'est aussi ce qui rend enfin
atteignable le 3-2-1 du §15.4, hors de portée avec un seul VPS.

## Déploiement

Le modèle **tiré** de l'[ADR 0023](adr/0023-deploiement-automatique-tire-par-le-vps.md)
se transpose sans changement : GitHub Actions construit et pousse sur GHCR, un
agent local détecte et exécute. Aucun accès entrant depuis GitHub, ni sur le VPS
ni sur le homelab — a fortiori sur une machine posée dans le salon.

La répétition de migration sur une restauration
([ADR 0021](adr/0021-pas-de-staging-la-restauration-sert-de-banc-d-essai.md))
continue de servir de banc d'essai. Elle devient d'ailleurs moins chère : le
téléchargement de la sauvegarde ne passe plus par la bande passante d'un VPS.

## Réseau et accès

- **DNS** : bascule à faire en dernier, une fois le homelab vérifié. Baisser le
  TTL quelques jours **avant** la migration, sinon le retour arrière prend la
  durée du cache.
- **Portfolio** : public sur Internet, inchangé.
- **Dashboard** : choix ouvert entre Tailscale seul et un accès Internet protégé
  par Authentik (§14.3). À trancher au moment venu, selon le confort sur mobile.
- **API** : jamais exposée hors du reverse proxy, sur les deux hébergements.
- **IP résidentielle** : port 443 parfois bloqué par le fournisseur d'accès,
  adresse dynamique, réputation d'envoi de courriel médiocre. À vérifier avant de
  s'engager sur une date.

## Le VPS après la bascule

Ne pas le résilier le jour même. Il peut devenir relais, point de sauvegarde,
instance de secours ou reverse proxy (§14.4) — et tant qu'il tourne, le retour
arrière reste possible. Le déclassement, lui, a un ordre :

1. DNS basculé et homelab vérifié pendant plusieurs jours ;
2. une restauration complète réussie **depuis le homelab** ;
3. `restic key remove` de la clé du VPS ;
4. suppression de sa clé applicative Backblaze ;
5. résiliation.

Retirer la clé Restic avant l'étape 2 revient à couper la corde avant d'avoir
touché le sol.
