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
| [#3](https://github.com/MaximeD1412/personal-os/issues/3) | Sauvegardes Restic chiffrées chez un autre fournisseur | hitl | **Disponible** | — |
| [#4](https://github.com/MaximeD1412/personal-os/issues/4) | Déploiement automatique tiré par le VPS, avec répétition de migration | hitl | À faire | #3 |
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
#3 sauvegardes ──▶ #4 déploiement ──▶ #5 Authentik ──▶ #6 garde d'Espace
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

Les trois tranches en tête (#3 → #5) sont toutes `hitl` : elles touchent des
secrets et des accès fournisseur. Un agent ne peut pas les prendre seul, et
**rien d'autre ne se débloque tant qu'elles ne sont pas faites**. C'est le
goulot du moment : #3 est la seule issue disponible, et elle demande une
intervention humaine.

## Journal

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
