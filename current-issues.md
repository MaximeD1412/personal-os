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
| [#4](https://github.com/MaximeD1412/personal-os/issues/4) | Déploiement automatique tiré par le VPS, avec répétition de migration | hitl | [PR #27](https://github.com/MaximeD1412/personal-os/pull/27) ouverte — reste les gestes manuels | — |
| [#5](https://github.com/MaximeD1412/personal-os/issues/5) | Session serveur OIDC via Authentik | hitl | À faire | #4 |
| [#6](https://github.com/MaximeD1412/personal-os/issues/6) | Garde d'Espace centralisée et tests de non-exposition | agent | À faire | #5 |
| [#7](https://github.com/MaximeD1412/personal-os/issues/7) | Calendrier : l'Événement daté avec son Espace explicite | agent | À faire | #6 |
| [#8](https://github.com/MaximeD1412/personal-os/issues/8) | Agenda : port AgendaContributor et vue en lecture seule | agent | À faire | #7 |
| [#9](https://github.com/MaximeD1412/personal-os/issues/9) | Récurrence : règle, exceptions et occurrences calculées | agent | À faire | #8 |
| [#10](https://github.com/MaximeD1412/personal-os/issues/10) | Sport : la Séance porte le prévu et le réalisé, et l'Objectif | agent | À faire | #8 |
| [#11](https://github.com/MaximeD1412/personal-os/issues/11) | Tableau de bord : À faire calculés et widgets de résumé | agent | À faire | #8 |
| [#12](https://github.com/MaximeD1412/personal-os/issues/12) | Catalogue d'Ingrédients, Alias et conversion en Unité canonique | agent | À faire | #6 |
| [#13](https://github.com/MaximeD1412/personal-os/issues/13) | Recettes | agent | À faire | #12 |
| [#14](https://github.com/MaximeD1412/personal-os/issues/14) | Foyer, Participants et Préférences alimentaires | agent | À faire | #6 |
| [#15](https://github.com/MaximeD1412/personal-os/issues/15) | Planning de repas saisi à la main | agent | À faire | #13 |
| [#16](https://github.com/MaximeD1412/personal-os/issues/16) | Génération IA du planning par Tours de génération, Souhaits et traçabilité | hitl | À faire | #15 |
| [#17](https://github.com/MaximeD1412/personal-os/issues/17) | Liste de courses figée à l'édition et consolidateur | agent | À faire | #15 |
| [#18](https://github.com/MaximeD1412/personal-os/issues/18) | Produits : conditionnement, produit préféré et arrondi | agent | À faire | #17 |
| [#19](https://github.com/MaximeD1412/personal-os/issues/19) | Stock domestique : clôture de liste, Repas cuisiné et péremptions | agent | À faire | #18 |
| [#20](https://github.com/MaximeD1412/personal-os/issues/20) | Écart entre planning et liste figée, et liste de complément | agent | À faire | #17 |
| [#21](https://github.com/MaximeD1412/personal-os/issues/21) | Projets, Présentation publique et État de publication | agent | À faire | #6 |
| [#22](https://github.com/MaximeD1412/personal-os/issues/22) | Portfolio public bilingue et Pages de contenu rédigées | hitl | À faire | #21 |
| [#23](https://github.com/MaximeD1412/personal-os/issues/23) | CV PDF téléversé et stockage objet | agent | À faire | #22 |
| [#24](https://github.com/MaximeD1412/personal-os/issues/24) | Barre de commande : catalogue généré, résolution d'intention et préremplissage | hitl | À faire | #11 |

## Chemin critique

Tout part du squelette, et rien de fonctionnel ne démarre avant la garde
d'**Espace** — c'est elle qui porte le cloisonnement, et
l'[ADR 0016](docs/adr/0016-modules-plats-et-filtrage-espace-centralise.md)
interdit de le rattraper module par module ensuite.

```
#4 déploiement ──▶ #5 Authentik ──▶ #6 garde d'Espace
                                                                            │
                        ┌───────────────────────────────┬───────────────────┤
                        ▼                               ▼                   ▼
                  #7 Calendrier                  #12 Ingrédients      #14 Foyer
                        │                               │             #21 Projets
                        ▼                               ▼                   │
                   #8 Agenda                      #13 Recettes              ▼
                        │                               │            #22 Portfolio
        ┌───────────┬───┴───────┐                       ▼                   │
        ▼           ▼           ▼                 #15 Planning              ▼
  #9 Récurrence #10 Sport  #11 Tableau            │        │           #23 CV PDF
                                │            #16 IA   #17 Liste
                                ▼                          │
                        #24 Barre de commande      ┌───────┴───────┐
                                                   ▼               ▼
                                            #18 Produits      #20 Écart
                                                   ▼
                                            #19 Stock domestique
```

Les deux tranches en tête (#4 et #5) sont `hitl` : elles touchent des secrets et
des accès fournisseur. Un agent ne peut pas les prendre seul, et **rien d'autre
ne se débloque tant qu'elles ne sont pas faites**. C'est toujours le goulot :
le code de #4 est en revue, mais l'issue reste ouverte tant que la machine n'a
pas été touchée, et **aucune ligne du tableau ne bouge d'ici là**.

La contrainte découverte en posant #3 — **le VPS n'est pas dédié**, `mairie` y
occupe 80, 443, 3000 et 5432 — est traitée. La répartition des ports du
[commentaire de #4](https://github.com/MaximeD1412/personal-os/issues/4#issuecomment-5258398573)
est en place, et le choix « Caddy partagé ou cloisonné » est **tranché en faveur
du cloisonnement**. #5 hérite donc d'un nom d'hôte stable : l'`issuer` OIDC y est
adossé, et trancher après coup aurait obligé à refaire le client OIDC.

## Journal

### 2026-08-11 — #4 Déploiement tiré

[PR #27](https://github.com/MaximeD1412/personal-os/pull/27) ouverte, **issue
volontairement non fermée** : la PR porte `Refs #4`, pas `Closes #4`.

Ce qui est livré : `verify.yml` partagé par la CI et la livraison, `livraison.yml`
qui publie les trois images sur GHCR et ne déplace le canal qu'une fois les trois
poussées, et `infra/deploy/` — l'agent, la pile de production, le routage Caddy,
les unités systemd, l'installation idempotente.

Deux arbitrages tranchés avant de commencer :

- **Cloisonnement du proxy**, pas partage. `mairie-caddy-1` reste proxy de tête
  et transmet à un Caddy interne sur `127.0.0.1:8080`. Ce Caddy ne termine pas
  TLS aujourd'hui — sa raison d'être est que la carte de routage vive dans le
  dépôt, versionnée et déployée par l'agent. Au homelab il reprend TLS : le
  cloisonnement se démonte, le partage se serait réécrit.
- **Le tableau de bord n'est pas publié.** Il n'aura d'authentification qu'avec
  #5, et son nginx relaie déjà `/api/`. Son bloc Caddy attend, désactivé.

Trois choses à savoir avant de reprendre le code :

- La révision déployée est un **commit**, lu dans le libellé OCI de l'image du
  canal. Jamais un tag mouvant : `main` désignerait autre chose demain, et le
  retour arrière perdrait sa cible.
- L'agent reprend le compose et le routage **du dépôt** à chaque déploiement,
  depuis un clone local. Il ne se met pas à jour lui-même : la dérive est
  signalée dans le journal et se corrige par un `install.sh`.
- Les deux campagnes d'intégration portent `"parallelism": false`. Elles
  nettoient toutes deux les conteneurs par le préfixe `personal-os-restore-` :
  lancées côte à côte, l'une détruit la restauration que l'autre interroge.

Ce qui reste, et qu'aucun agent ne peut faire : le DNS, la visibilité des
paquets GHCR, le bloc `reverse_proxy` dans le Caddyfile de `mairie`, et la pose
des secrets sur la machine. Runbook dans `infra/deploy/README.md`. Le critère
« joignable en HTTPS sur son domaine » se vérifie à ce moment-là.

**#5 reste bloquée** tant que #4 n'est pas fermée. Retirer sa ligne à
l'ouverture de la PR débloquerait une tranche OIDC dont le nom d'hôte n'existe
pas encore.

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
