# Personal OS : consignes pour les agents

Application web privée (deux comptes, cloisonnés par Espace) et portfolio public
bilingue. Le vocabulaire du domaine fait autorité : [`CONTEXT.md`](CONTEXT.md).
Les décisions sont dans [`docs/adr/`](docs/adr). En cas de désaccord, un ADR
l'emporte sur la note produit et sur le PRD (#1).

## Le dépôt

Monorepo Nx, pnpm.

- `packages/api` : API NestJS sous `/api`. Un dossier par module dans
  `src/app/`, chacun **plat** (contrôleur, service, dépôt) tant qu'aucune vraie
  règle n'en justifie un module profond (ADR 0016).
- `packages/contracts` : les schémas zod partagés par l'API et le front. **Un
  contrat n'est défini qu'ici** (ADR 0030).
- `packages/database` : schéma Prisma, `PrismaService`, garde d'Espace
  (ADR 0016, 0028).
- `packages/dashboard` (tableau de bord privé) et `packages/portfolio` (public) :
  Angular, Tailwind v4, spartan/ui (ADR 0029).
- `packages/ui` : les composants du design system, spartan (`hlm`) ou propres
  (`dccm`), et leur Storybook (`nx run dccm:storybook`).
  `packages/theme/tokens.css` porte les jetons, sous les noms de pen.dev.
  **Avant de toucher un écran ou un composant, lis
  [`docs/design-system.md`](docs/design-system.md).**
- `infra/` : `deploy` (agent de déploiement), `backup` (Restic), `edge` (proxy
  de tête). Chaque dossier a son README, qui fait foi pour l'exploitation.

## Conventions

Les conventions d'API sont dans l'**[ADR 0030](docs/adr/0030-conventions-d-api.md)**,
à lire avant de toucher une route. L'essentiel :

- **Les contrats sont des schémas zod** dans `contracts`, validés par le pipe
  global, avec un schéma de sortie par route. Pas de validation de forme dans
  les services.
- **Les erreurs** ont une seule enveloppe : `{ status, code, message, fields? }`.
  `code` est en anglais (`<module>.<cas>`), `message` en français. 400 pour un
  schéma non respecté, 422 pour une règle métier, 404 pour un objet absent ou
  d'un autre Espace.
- **Les routes** : des noms au pluriel en kebab-case. Une transition est une
  action, `POST /<ressource>/:id/<verbe>`. **Un statut ne se modifie jamais par
  PATCH.**
- **Toute liste a une borne** : une période (`from`, `to`), un filtre, ou un
  curseur pour un journal en ajout seul.
- **Les dates** : `zInstant` (UTC), `zDay` (`YYYY-MM-DD`, jamais converti en
  instant), `zWeek` (le lundi). Le fuseau de calcul est `Europe/Paris`. Les
  montants sont en centimes.
- **L'Espace** : obligatoire à la création, jamais déduit d'un contexte. Un
  module à Espace unique (la Cuisine, sur l'Espace foyer) le pose lui-même. On
  ne filtre **jamais** à la main dans un service : la garde s'en charge.
- **Les écrans de saisie** sont adressables par une route et se préremplissent
  depuis les paramètres de requête. Ils n'enregistrent jamais rien d'eux-mêmes.
- **Le front** : un service de transport par ressource, typé par `contracts`.
  Les lectures passent par `httpResource`. L'écran affiche le `message` de
  l'API, jamais un message générique de remplacement.

### Langue

- **En anglais**, tout ce qui traverse une frontière : routes d'API, champs,
  contrats, entités, codes d'erreur, noms de fichiers et de dossiers.
- **En français**, le vocabulaire interne d'un module (méthodes, fonctions,
  variables, classes qui portent un concept du domaine), les commentaires,
  les textes affichés et les URL du front (`/calendrier/evenements/nouveau`).

Exemple : `ShoppingListService.cloturer()` sert `POST /shopping-lists/:id/close`
et lève `food.list_already_closed`.

### Du domaine au code

| Domaine (`CONTEXT.md`) | Code |
| --- | --- |
| Espace, Espace personnel, Espace foyer | `Scope`, `PERSONAL`, `HOUSEHOLD` |
| Foyer, Compte | `Household`, `User` |
| Participant, Invités | `participantIds` (des `User`), `guestCount` |
| Événement, Échéance | `Event`, catégorie `DEADLINE` |
| Agenda | `agenda`, port `AgendaContributor` |
| Séance, Objectif | `TrainingSession`, `TrainingGoal` |
| Ingrédient, Alias, Unité canonique | `Ingredient`, `IngredientAlias`, `canonicalUnit` |
| Recette | `Recipe` |
| Planning de repas, Repas planifié | `MealPlan`, `MealPlanEntry` |
| Tour de génération, Souhait | `GenerationRound`, `MealWish` |
| Préférence alimentaire, Allergène | `FoodPreference`, `Allergen` |
| Liste de courses, Article de courses | `ShoppingList`, `ShoppingListItem` |
| Produit, Produit préféré | `Product`, `preferredProduct` |
| Stock domestique | `PantryItem` |
| Repas cuisiné | `CookedMeal` |
| Projet, Présentation publique | `Project`, `PublicPresentation` |
| Page de contenu | `PageContent` |

Les modules Nest : `calendar`, `agenda`, `training`, `food`, `projects`,
`portfolio`, `dashboard`, `command-bar`. Un terme absent de cette table se
traduit en restant au plus près du glossaire, et la traduction s'ajoute ici
dans la même PR.

## Prendre une décision seul

Un ticket est écrit pour qu'aucune question ne reste. S'il en reste une :

- **elle ne change pas le comportement visible** (un nommage, une structure
  interne) : décide en suivant les ADR et ces conventions, et note la décision
  dans la description de la PR ;
- **elle le change**, ou le ticket contredit un ADR : arrête-toi. Écris la
  raison (dans `blocked.md` sous `agent-loop`, sinon dans un commentaire du
  ticket) et laisse le ticket en `needs-human`.

## Vérifier

Une base Postgres locale est nécessaire pour l'intégration : `pnpm db:up`.
Chaque exécution crée sa propre base jetable, si bien que plusieurs worktrees
peuvent tester en même temps.

- **Pendant le red/green**, un seul fichier :
  `pnpm exec nx test api -- event.service` ou
  `pnpm exec nx test-integration api -- calendar`.
- **Avant la PR**, ce que le diff atteint, en parallèle :
  `pnpm exec nx affected -t lint test build --base=origin/develop`,
  plus les fichiers d'intégration des modules touchés.
- **Jamais la suite d'intégration complète en local.** La CI la rejoue.

### Ce que chaque route prouve (ADR 0030)

Des tests d'intégration sur une vraie base :

1. le cas nominal, avec une réponse conforme au schéma de sortie ;
2. un body invalide, qui donne un 400 dont `fields` pointe le bon champ ;
3. chaque règle métier, qui donne un 422 avec son `code` ;
4. si le module accepte un Espace personnel : l'objet de l'autre utilisateur
   donne un 404, en lecture comme en écriture ;
5. sans session, un 401, sauf pour une route `@Public()`.

Une règle métier non triviale vit dans un module profond, testé en unitaire.

## Livrer un ticket

- Une branche `feat/<n>-<slug>` (ou `fix/`) depuis `develop`, et une PR vers
  `develop` avec `Closes #<n>`. `main` est la branche de livraison : on n'y
  pousse jamais directement, et la PR `develop` → `main` est faite à la main.
- Une migration ne retire jamais ce que la version précédente utilise encore
  (ADR 0024).
- **Revue visuelle** (`revue_visuelle: true` dans le ticket, label
  `revue-visuelle`) : joins à la PR des captures mobile (390 px) et desktop
  (1280 px) de chaque écran touché, ouvert par son URL préremplie. Le merge
  attend l'approbation humaine : `agent-loop` met la PR en attente, puis la
  merge sur le label `revue-visuelle-ok` (ou une review « Approve »), ou la
  reprend en correction sur `revue-visuelle-ko`.

### Les fichiers de pilotage

Ils se mettent à jour **dans la PR du ticket**. Codex les relit avec le reste.
Ils alimentent l'artifact [Pilotage Personal OS](https://claude.ai/artifact/HQqnhrKxc7crEEKayomxP9),
republié après chaque merge par `pilotage publish` (`.pilotage.json`, outil
partagé `~/.agents/tools/pilotage`). Les formats sont décrits dans son README.

- `docs/pilotage/mep.json` : ce que la mise en production exige (variable,
  secret, geste manuel, vérification). Un élément par geste, avec un `id`
  stable et la source `#<n>`. Si le ticket n'exige rien, ne touche à rien.
- `docs/pilotage/risques.json` : pour chaque risque cité dans le frontmatter
  du ticket (`risques:`), coche les solutions mises en place, passe le statut à
  `implémenté` quand elles le sont toutes, et date le changement
  (`statutDepuis`).
- `docs/pilotage/architecture.json` : seulement si le ticket ajoute ou retire
  un bloc de l'architecture. Les plans sont dessinés à la main : un nouveau
  bloc prend une place libre dans sa zone sans chevaucher les autres, et ses
  liens sont des segments horizontaux et verticaux. L'état des blocs existants
  se calcule seul à partir de leurs tickets : n'y touche pas.
