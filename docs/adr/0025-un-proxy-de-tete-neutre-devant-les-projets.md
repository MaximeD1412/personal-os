# Un proxy de tête neutre devant les projets, avec certificat joker

> **Statut :** accepté — 26 août 2026
> Révise le montage retenu en [#4](https://github.com/MaximeD1412/personal-os/issues/4),
> où `mairie-caddy-1` était promu proxy de tête.

La machine héberge plusieurs projets et **un seul processus peut tenir 443**. Le port est désormais détenu par un proxy **neutre**, `caddy-edge`, qui n'appartient à aucun projet : il termine TLS et route par nom d'hôte vers le proxy interne de chaque locataire, sur un réseau Docker partagé.

Personal OS reçoit **tout son domaine** — `dccm.fr` et `*.dccm.fr` — derrière un certificat joker obtenu par challenge DNS-01. Ce qui arrive ensuite est décidé par le `Caddyfile` de ce dépôt, versionné et déployé par l'agent ([ADR 0023](0023-deploiement-automatique-tire-par-le-vps.md)).

La conséquence est la propriété recherchée : **ajouter un sous-domaine ne touche rien hors de ce dépôt.** Le tableau de bord (#5), Authentik (#5) et tout ce qui viendra ensuite s'ajoutent dans une configuration que le déploiement livre déjà.

## Options écartées

- **Promouvoir le Caddy d'un projet en proxy de tête** (le montage de #4). Aucune pièce nouvelle, mais chaque hôte ajouté à Personal OS demandait une modification dans la configuration d'un **autre** projet, hors de son dépôt — et redémarrer le proxy pour l'un coupait l'autre. La séparation était nominale : le projet hôte restait propriétaire de l'entrée.
- **Certificat par hôte explicite sur le proxy de tête.** Pas de module DNS ni de jeton d'API, mais deux lignes à ajouter dans l'edge à chaque sous-domaine. C'est précisément le geste que cette décision existe pour supprimer.
- **Routage SNI sans déchiffrer, chaque projet gardant son TLS.** Préserve intégralement la configuration existante des locataires, mais exige `caddy-l4`, hors du Caddyfile standard, et rend l'edge nettement moins relisible — pour une propriété dont personne n'a besoin ici, puisque les deux projets sont sur la même machine et administrés par la même personne.

## Conséquences

- L'edge n'est **pas déployé par l'agent**. Le faire redonnerait à Personal OS la propriété de l'entrée, et déplacerait le problème au lieu de le résoudre. Il vit dans ce dépôt pour être versionné et documenté, mais s'installe à la main — tenable précisément parce que le routage par domaine le rend immuable.
- Les locataires **cessent de publier 80 et 443** et rejoignent le réseau de l'edge. Pour `mairie`, c'est une modification unique et quelques secondes de coupure.
- Le certificat joker impose un **jeton d'API DNS** sur la machine. C'est un secret de plus, mais il ne donne accès qu'à la zone DNS — jamais au serveur, ni aux données.
- Un joker ne couvre **qu'un seul niveau** : `app.dccm.fr` est couvert, `a.b.dccm.fr` ne l'est pas. Et il ne couvre pas l'apex, qui est donc listé explicitement à côté.
- Le volume de certificats de l'edge est à préserver. Le perdre n'est pas grave en soi — ils se réémettent — mais les quotas de l'autorité de certification transforment une bêtise en indisponibilité de plusieurs heures.
- À la migration vers le homelab, l'edge se transpose tel quel : c'est la seule pièce qui connaît le DNS et les certificats, et elle ne connaît rien d'autre.
