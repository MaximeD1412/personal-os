# Issues en cours

Source de vérité pour choisir la prochaine tranche à implémenter. Une issue est
**disponible** quand sa colonne « Bloquée par » est `—`, ou quand toutes les
issues qui y figurent sont fermées.

- **`agent`** : implémentable de bout en bout par un agent.
- **`hitl`** : demande une intervention humaine (secrets, accès fournisseur,
  arbitrage produit). À ne pas prendre en autonomie.

Une ligne disparaît de ce tableau quand son issue est **fermée** — pas quand sa
PR est ouverte. Retirer une ligne trop tôt débloquerait à tort ses dépendantes.

| Issue | Titre | Type | État | Bloquée par |
| --- | --- | --- | --- | --- |
| [#1](https://github.com/MaximeD1412/personal-os/issues/1) | PRD — Personal OS V1 | agent | Épique — ne s'implémente pas directement | — |
| [#7](https://github.com/MaximeD1412/personal-os/issues/7) | Calendrier : l'Événement daté avec son Espace explicite | agent | [PR #40](https://github.com/MaximeD1412/personal-os/pull/40) ouverte | — |
| [#8](https://github.com/MaximeD1412/personal-os/issues/8) | Agenda : port AgendaContributor et vue en lecture seule | agent | À faire | #7 |
| [#9](https://github.com/MaximeD1412/personal-os/issues/9) | Récurrence : règle, exceptions et occurrences calculées | agent | À faire | #8 |
| [#10](https://github.com/MaximeD1412/personal-os/issues/10) | Sport : la Séance porte le prévu et le réalisé, et l'Objectif | agent | À faire | #8 |
| [#11](https://github.com/MaximeD1412/personal-os/issues/11) | Tableau de bord : À faire calculés et widgets de résumé | agent | À faire | #8 |
| [#12](https://github.com/MaximeD1412/personal-os/issues/12) | Catalogue d'Ingrédients, Alias et conversion en Unité canonique | agent | À faire | — |
| [#13](https://github.com/MaximeD1412/personal-os/issues/13) | Recettes | agent | À faire | #12 |
| [#14](https://github.com/MaximeD1412/personal-os/issues/14) | Foyer, Participants et Préférences alimentaires | agent | À faire | — |
| [#15](https://github.com/MaximeD1412/personal-os/issues/15) | Planning de repas saisi à la main | agent | À faire | #13 |
| [#16](https://github.com/MaximeD1412/personal-os/issues/16) | Génération IA du planning par Tours de génération, Souhaits et traçabilité | hitl | À faire | #15 |
| [#17](https://github.com/MaximeD1412/personal-os/issues/17) | Liste de courses figée à l'édition et consolidateur | agent | À faire | #15 |
| [#18](https://github.com/MaximeD1412/personal-os/issues/18) | Produits : conditionnement, produit préféré et arrondi | agent | À faire | #17 |
| [#19](https://github.com/MaximeD1412/personal-os/issues/19) | Stock domestique : clôture de liste, Repas cuisiné et péremptions | agent | À faire | #18 |
| [#20](https://github.com/MaximeD1412/personal-os/issues/20) | Écart entre planning et liste figée, et liste de complément | agent | À faire | #17 |
| [#21](https://github.com/MaximeD1412/personal-os/issues/21) | Projets, Présentation publique et État de publication | agent | À faire | — |
| [#22](https://github.com/MaximeD1412/personal-os/issues/22) | Portfolio public bilingue et Pages de contenu rédigées | hitl | À faire | #21 |
| [#23](https://github.com/MaximeD1412/personal-os/issues/23) | CV PDF téléversé et stockage objet | agent | À faire | #22 |
| [#24](https://github.com/MaximeD1412/personal-os/issues/24) | Barre de commande : catalogue généré, résolution d'intention et préremplissage | hitl | À faire | #11 |

## Chemin critique

La garde d'**Espace** est posée et #6 est fermée : **quatre chemins partent
désormais en parallèle**, et trois d'entre eux n'attendent personne.

```
#7 Calendrier      #12 Ingrédients      #14 Foyer      #21 Projets
      │                    │                                │
      ▼                    ▼                                ▼
 #8 Agenda           #13 Recettes                     #22 Portfolio
      │                    │                                │
      ├────────┬───────────┼──────────┐                     ▼
      ▼        ▼           ▼          │                #23 CV PDF
#9 Récur.  #10 Sport  #11 Tableau     ▼
                          │      #15 Planning
                          ▼        │        │
                #24 Barre de       ▼        ▼
                   commande    #16 IA   #17 Liste
                                            │
                                    ┌───────┴───────┐
                                    ▼               ▼
                             #18 Produits      #20 Écart
                                    ▼
                             #19 Stock domestique
```

**#7 est la seule des quatre à être engagée** ([PR #40](https://github.com/MaximeD1412/personal-os/pull/40)) ;
#12, #14 et #21 sont libres et indépendantes l'une de l'autre. #7 est aussi la
plus structurante des quatre : elle seule débloque #8, qui commande à son tour
#9, #10, #11 et, par ricochet, #24.

**Ce qu'il reste de #5 est sur la machine, pas dans le code.** L'issue est
fermée et le code est dans `develop`, mais Authentik n'est configuré nulle
part : DNS pour `app.` et `auth.`, fournisseur OIDC, deux comptes, report des
valeurs dans `/opt/personal-os/.env`. Le runbook est dans
`infra/deploy/README.md`. Rien de tout cela ne bloque les tranches suivantes,
qui se développent et se testent en local.

## Journal

### 2026-08-27 — #6 Garde d'Espace centralisée

**Fermée**, [PR #39](https://github.com/MaximeD1412/personal-os/pull/39)
fusionnée dans `develop`. Deux ADR :
[0028](docs/adr/0028-la-portee-d-espace-est-ouverte-par-requete.md) pour le
chemin par lequel l'**Espace** atteint l'accès aux données, et
[0014](docs/adr/0014-deux-utilisateurs-cloisonnes-par-espace.md) pour ce qu'il
compartimente.

Le filtrage vit dans une extension Prisma posée sur le seul client que
`packages/database` exporte, et la portée voyage dans un `AsyncLocalStorage`
plutôt que dans les signatures. Aucun service n'a de filtre à écrire.

**#7 a servi de première épreuve, et le mécanisme a tenu sans qu'on l'aide.**
Trois constats de la tranche suivante, qui valent pour toutes les autres :

- **Un modèle nouveau est cloisonné sans rien déclarer.** Il a suffi de ne pas
  inscrire `Event` dans `MODELES_HORS_ESPACE` ; le test structurel de
  `modeles.spec.ts` l'a reconnu seul. Les deux seules lignes à toucher étaient
  la relation `Scope.events`, que ce même test réclame explicitement.
- **Le dépôt d'un module reste vide de tout `scopeId`.** `event.repository.ts`
  appelle `prisma.event.findMany()` sans rien passer. En trouver un à la main
  signalerait que la garde a été contournée.
- **Le jeu d'Espaces de la campagne d'intégration se reprend tel quel.**
  `poserLeJeuDEspaces` a donné les deux comptes et le Foyer sans une ligne
  d'adaptation — les tests de non-exposition de #7 se sont écrits directement
  contre lui.

**Le fil traceur (entité `Trace`) est toujours là.** Le schéma et les contrats
annoncent tous deux qu'il disparaîtra « le jour où un vrai module portera un
Espace » : c'était #7. Le retirer demande de réécrire les tests de
non-exposition et `module-restreint.ts` sur l'**Événement**, ce qui débordait de
#7. À faire dans une tranche dédiée — et **sans jamais interrompre l'exercice de
la garantie** : ce sont ces tests-là qui prouvent le cloisonnement.

### 2026-08-26 — #5 Session serveur OIDC

**Fermée**, [PR #35](https://github.com/MaximeD1412/personal-os/pull/35)
fusionnée dans `develop`. Suite dans
[#37](https://github.com/MaximeD1412/personal-os/pull/37) — deux correctifs de
déploiement, à faire passer **avant** de livrer sur `main`.

L'API est un client OIDC ordinaire : elle échange le code avec PKCE, vérifie la
signature contre le jeu de clés publié, et émet sa propre session. Le jeton
d'Authentik meurt dans l'API. La session est une rangée en base, le cookie ne
porte qu'un jeton opaque dont seule l'empreinte est stockée — c'est ce qui rend
la déconnexion réelle. Deux ADR : [0026](docs/adr/0026-session-en-base-et-api-fermee-par-defaut.md)
et [0027](docs/adr/0027-un-seul-postgresql-pour-l-application-et-authentik.md).

**Rien n'est configuré sur la machine.** Le code est là, Authentik ne tourne
nulle part. La tranche n'est vraiment finie qu'après les gestes du runbook
(`infra/deploy/README.md`).

Cinq choses à savoir avant de reprendre le code :

- **L'API est fermée par défaut.** La garde est en `APP_GUARD` ; une route
  s'ouvre en portant `@Public()`, et quatre le font — départ du flux, retour,
  déconnexion, sonde de santé. Un module nouveau est protégé sans que personne
  n'y pense. C'est le même raisonnement que le filtrage par **Espace** de #6,
  une couche plus haut.
- **L'admission est une liste d'adresses en configuration**
  (`AUTH_ALLOWED_EMAILS`). Hors liste : 403, et **aucune rangée créée**. Une
  liste vide fait refuser le démarrage de l'API.
- **`DASHBOARD_HOST` et `AUTHENTIK_HOST` ne sont plus facultatifs.** Leurs blocs
  Caddy sont chargés par le glob `conf.d/*.caddy`, et un nom vide donne une
  adresse de site que Caddy refuse : le proxy interne ne démarre pas, le
  portfolio tombe avec lui. La sonde de santé n'interrogeant que l'API, aucun
  retour arrière ne se déclenchait — d'où le `:?` ajouté en #37.
- **Le rôle et la base d'Authentik se créent seuls**, par un service `db-init`
  idempotent rejoué à chaque déploiement. Pas par
  `/docker-entrypoint-initdb.d`, qui ne tourne que sur un volume vierge : cette
  étape compte surtout le jour d'une restauration.
- **Les données d'Authentik sont en montage lié**, sous uid 1000. Docker
  créerait les répertoires en `root` et l'IdP ne pourrait pas y écrire : les
  créer avant, avec le bon propriétaire.

Deux défauts trouvés en chemin, tous deux du genre qui revient :

- **`die` dans une substitution de processus n'arrête que le sous-shell.** La
  validation des noms de bases y vivait : une configuration refusée produisait
  quand même une sauvegarde, amputée et silencieuse, avec un état de sortie nul.
- **`docker logs … | grep -q` sous `pipefail` rend 141 quand la marque EST
  trouvée.** `grep -q` sort à la première correspondance, le producteur qui
  écrit encore prend EPIPE. La boucle d'attente sortait sur un succès et le
  contrôle juste après échouait — trois secondes au lieu de soixante. Le défaut
  datait de #4 et pouvait **arrêter un déploiement sain**, puisque `restore.sh`
  est le banc d'essai de migration. Corrigé en #37.

Les deux dettes posées en #3 sont réglées : `backup.sh` accepte une liste de
bases (`POSTGRES_DATABASES`) et `restore.sh` remonte celle qu'on lui nomme. La
configuration d'Authentik vit en **base**, pas dans des fichiers — c'est
`POSTGRES_DATABASES` qui l'emporte, `BACKUP_PATHS` ne prenant que ses médias.

Deux contraintes d'outillage, qui vaudront pour les tranches suivantes :
`cookie@2` et `jose@6` sont **ESM purs** et l'API est en CommonJS. Le premier
est parti — l'en-tête `Cookie` se découpe en huit lignes — et le second est
épinglé en `^5`.

### 2026-08-26 — #4 Déploiement tiré

**Fermée**, timer armé sur la machine. PR [#27](https://github.com/MaximeD1412/personal-os/pull/27),
[#28](https://github.com/MaximeD1412/personal-os/pull/28),
[#30](https://github.com/MaximeD1412/personal-os/pull/30) et
[#32](https://github.com/MaximeD1412/personal-os/pull/32).

Un commit sur `main` part en production. L'agent lit la révision au libellé OCI
du canal, répète la migration sur une restauration de la dernière sauvegarde,
applique, vérifie la santé, et revient aux images précédentes sans toucher la
base. `portfolio.dccm.fr` répond en HTTPS.

**Le montage du proxy a changé en cours de route.** Le plan initial promouvait
`mairie-caddy-1` en proxy de tête. Ça marchait, mais la séparation était
nominale : chaque hôte ajouté à Personal OS demandait une modification dans la
configuration d'un autre projet. Un proxy **neutre** l'a remplacé, avec un
certificat joker `*.dccm.fr` obtenu par DNS-01
([ADR 0025](docs/adr/0025-un-proxy-de-tete-neutre-devant-les-projets.md),
`infra/edge/`). Ajouter un sous-domaine ne touche plus rien hors de ce dépôt.

Quatre choses à savoir avant de reprendre le code :

- La révision déployée est un **commit**, lu dans le libellé OCI. Jamais un tag
  mouvant : `main` désignerait autre chose demain, et le retour arrière
  perdrait sa cible.
- L'agent reprend le compose et le routage **du dépôt** à chaque déploiement,
  depuis un clone local. Il ne se met pas à jour lui-même : la dérive est
  signalée dans le journal et se corrige par un `install.sh`. Une PR qui touche
  `infra/deploy/bin/` ou `lib/` demande donc ce geste sur la machine.
- L'edge n'est **pas** déployé par l'agent, et c'est délibéré : le faire
  redonnerait à Personal OS la propriété de l'entrée de la machine.
- Les deux campagnes d'intégration portent `"parallelism": false`. Elles
  nettoient toutes deux les conteneurs par le préfixe `personal-os-restore-` :
  lancées côte à côte, l'une détruit la restauration que l'autre interroge.

Quatre défauts découverts en posant la tranche sur la machine, tous corrigés —
ils valent d'être connus parce que les mêmes formes reviendront :

- un conteneur ne peut pas joindre un port publié sur `127.0.0.1` de l'hôte ;
  c'est son propre loopback qu'il voit. Le README prescrivait l'inverse ;
- `admin off` dans un Caddyfile coupe l'API que `caddy reload` utilise —
  et oblige à redémarrer, donc à couper tous les locataires ;
- l'image PostgreSQL crée la base sur un serveur **temporaire** qu'elle éteint
  ensuite : une requête qui aboutit ne prouve pas que le serveur est le bon
  ([#28](https://github.com/MaximeD1412/personal-os/pull/28)) ;
- `set -e` faisait sortir l'agent sans repasser par ses enregistrements : un
  échec imprévu ne laissait qu'une ligne `debut`, et le timer le rejouait
  toutes les deux minutes.

Deux traces à nettoyer quand la confiance sera acquise : le volume `src_db-data`
de l'ancienne pile, et `/opt/personal-os/src/.env` qui en portait le mot de
passe.

### 2026-08-11 — #3 Sauvegardes Restic

**Fermée**, [PR #26](https://github.com/MaximeD1412/personal-os/pull/26)
fusionnée dans `develop` (`e11215d`).

`infra/backup/` livre la sauvegarde, la restauration scriptée, les unités
systemd, le signalement d'échec et le runbook. Le va-et-vient est exercé contre
le vrai binaire Restic en test d'intégration, et la vérification interroge la
base **restaurée** — l'interroger sur la source ne prouverait que la santé de la
source.

Validé sur la machine : dépôt chez Backblaze B2, secrets posés hors de Git,
timer en place, restauration complète vérifiée, et chemin d'échec déclenché
volontairement — courriel reçu, témoin d'inactivité passé au rouge.

Deux critères sont partis en aval plutôt que de rester ouverts ici, parce
qu'Authentik et le stockage objet n'existaient pas au moment de poser la
tranche :

- base et configuration **Authentik** → critère 1 de #5 ;
- **objets stockés** → critère 1 de #23.

C'est le bon sens de dépendance. Rouvrir #3 en la déclarant bloquée par #5
fermerait une boucle avec #4, elle-même bloquée par #3 : plus rien ne serait
prenable.

Deux choses à savoir avant de reprendre le code :

- `backup.sh` ne dumpe **qu'une** base. Authentik ayant la sienne, #5 devra lui
  faire accepter une liste. C'est la seule évolution de script prévue —
  l'ajout de chemins passe par `BACKUP_PATHS`, sans toucher au code.
- `restore.sh` expose une ligne `dsn:` seule sur la sortie standard : c'est le
  contrat que le banc d'essai de migration de #4 consomme, et un test le
  verrouille.

`.env.example` ne documente que les variables de `nx serve`, pas celles du
compose. Recopié tel quel sur le VPS, il fait retomber compose sur ses valeurs
par défaut — donc `0.0.0.0` sur tous les ports publiés, en silence. Reporté à
#4 avec la configuration de production.

### 2026-08-04 — #2 Squelette applicatif

**Fusionnée** dans `develop`
([PR #25](https://github.com/MaximeD1412/personal-os/pull/25), `c784213`).

Monorepo Nx avec l'API NestJS, le tableau de bord Angular, le portfolio Angular
et la bibliothèque de contrats partagés, adossés à PostgreSQL via Prisma.
`docker compose up` démarre les quatre services ; le tableau de bord affiche une
valeur lue en base via l'API.

Conventions posées, qui font jurisprudence pour les tranches suivantes :

- Modules plats — contrôleur, service, accès aux données, DTO
  ([ADR 0016](docs/adr/0016-modules-plats-et-filtrage-espace-centralise.md)).
- `packages/database` est le point d'accès unique où viendra se brancher le
  filtrage par **Espace** de l'issue #6.
- Les types qui traversent le réseau vivent dans `@personal-os/contracts`, et
  transitent en JSON — dates ISO-8601, jamais de `Date`.
- Deux campagnes de test : `pnpm test` sans infrastructure,
  `pnpm test:integration` sur une base créée, migrée puis supprimée.

Quatre contraintes rencontrées, à connaître avant de reprendre le code :

- Angular ne supporte pas les project references TypeScript
  ([angular#37276](https://github.com/angular/angular/issues/37276)) : le
  monorepo est en Nx intégré classique, avec les alias de `tsconfig.base.json`.
- PostgreSQL 18 veut son volume monté sur `/var/lib/postgresql`, pas sur
  `/var/lib/postgresql/data`.
- Prisma 7 impose le générateur `prisma-client`, un `prisma.config.ts` et un
  driver adapter. La sonde technique est posée par une migration plutôt qu'un
  script de seed, pour que le conteneur démarre amorcé sans étape supplémentaire.
- La version de pnpm est épinglée par `packageManager` dans `package.json` :
  `pnpm/action-setup` refuse de s'installer sans, et corepack s'en sert dans les
  images. La changer à un seul endroit suffit — ne pas la dupliquer dans le
  workflow.
