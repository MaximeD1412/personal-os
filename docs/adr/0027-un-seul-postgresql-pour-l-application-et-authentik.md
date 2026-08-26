# Un seul PostgreSQL pour l'application et pour Authentik

> **Statut :** accepté — 26 août 2026
> Écarte le montage de la composition officielle d'Authentik, qui lui donne son
> propre serveur.

Authentik reçoit sa **base**, pas son **serveur** : `personal-os-db` héberge
`personalos` et `authentik`, chacune avec son rôle propriétaire.

Le VPS n'est pas dédié — le projet `mairie` y tourne déjà — et une seconde
instance PostgreSQL y coûterait sa mémoire pour rien. Surtout, la sauvegarde
reste **un seul geste** : `POSTGRES_DATABASES` est une liste de noms de bases,
`backup.sh` les dumpe toutes dans le même instantané, et la configuration
d'Authentik revient à la même date que les données de l'application. Deux
serveurs auraient demandé une liste de paires conteneur:base, et deux
restaurations à recoller.

Le rôle et la base sont créés par un service `db-init`, **idempotent et rejoué
à chaque déploiement**. Il ne passe pas par `/docker-entrypoint-initdb.d` :
celui-ci ne s'exécute que sur un volume vierge, or le volume de production
existe depuis la première tranche. Une étape qui ne tourne que sur une
installation neuve est une étape qu'on oublie exactement le jour où elle
compte — celui d'une restauration.

## Options écartées

- **Un conteneur PostgreSQL dédié à Authentik**, comme le fait sa composition
  officielle. Montages de version indépendants, aucune création de base à
  organiser. Mais un serveur de plus en mémoire, et une sauvegarde qui doit
  apprendre à parler à deux conteneurs.
- **Un script dans `/docker-entrypoint-initdb.d`.** Plus simple à lire, mais
  muet sur le volume existant : la base d'Authentik n'y serait jamais créée.
- **Créer la base à la main, une fois.** C'est une tranche HITL, l'humain est
  là. Mais la restauration, elle, se fait un jour de panne, et c'est
  précisément le jour où l'on ne se souvient pas d'une commande notée ailleurs.
- **Faire tourner Authentik sous le rôle `personalos`.** Une création de moins,
  mais l'IdP aurait alors les droits du superutilisateur sur les données de
  l'application — la frontière de l'ADR 0015 passerait mal.

## Conséquences

- Une montée de version majeure de PostgreSQL concerne les deux bases à la
  fois. À deux utilisateurs et deux bases, c'est un dump et un restore.
- `POSTGRES_USER` doit pouvoir dumper les deux bases. C'est le
  superutilisateur du serveur : il le peut.
- Le mot de passe d'Authentik est réappliqué à chaque déploiement (`ALTER
  ROLE`). Le faire tourner dans `/opt/personal-os/.env` suffit donc à le faire
  tourner en base.
- Authentik n'a **pas** de Redis : depuis 2025 il tient ses files et son cache
  dans PostgreSQL. Une pièce d'infrastructure en moins à surveiller.
- Le socket Docker n'est pas monté dans le worker, contrairement à la
  composition officielle. Il ne sert qu'aux outposts, et Personal OS est un
  client OIDC ordinaire : le monter donnerait à l'IdP la main sur la machine
  entière — celle qui héberge fiches de paie et documents immobiliers.
