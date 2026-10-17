# Les conventions d'API sont fixées une fois, avant les modules

> **Statut :** accepté. 17 octobre 2026.
> Précise l'[ADR 0014](0014-deux-utilisateurs-cloisonnes-par-espace.md) pour les
> modules à Espace unique, et corrige le PRD ([#1](https://github.com/MaximeD1412/personal-os/issues/1))
> sur un point : il n'existait aucun OpenAPI à partir duquel générer le
> catalogue de la barre de commande ([ADR 0018](0018-barre-de-commande-prepare-mais-n-execute-jamais.md)).

Les modules à venir (Cuisine, Sport, Projets, Portfolio, Tableau de bord, Barre
de commande) sont implémentés par des agents en autonomie. Sans règle écrite,
chaque agent aurait réinventé sa propre validation, son format d'erreur et sa
pagination. C'est déjà le cas aujourd'hui : la validation est écrite à la main
dans chaque service, et le front remplace les erreurs par des messages
génériques. Les conventions sont donc fixées **avant** le premier module, sur les
deux qui existent (`events`, `agenda`), et migrées sur eux en premier pour servir
d'exemple à imiter.

## Les contrats sont des schémas zod

Un contrat est défini **une seule fois**, en zod, dans `@personal-os/contracts`.
Les types TypeScript sont déduits des schémas (`z.infer`), et l'API comme le
front importent les mêmes schémas.

- **Les entrées.** `nestjs-zod` fournit un `ZodValidationPipe` global : un body,
  une query ou des params qui ne respectent pas le schéma sont refusés avant
  d'atteindre le contrôleur. Il n'y a plus de validation de forme dans les
  services. Il n'y reste que les règles métier.
- **Les sorties.** Chaque route déclare son schéma de réponse
  (`@ZodSerializerDto`). Un champ interne ne peut donc pas fuiter.
- **L'OpenAPI** est généré à partir de ces schémas. C'est sur lui que le
  catalogue de la barre de commande sera construit.
- **Les formes de valeur** n'ont qu'un schéma chacune, dans `contracts` :
  - `zInstant` : un instant, ISO-8601 avec `Z`, stocké en `timestamptz` ;
  - `zDay` : un jour civil `YYYY-MM-DD`, stocké en `date`, **jamais** converti en
    instant (une péremption, le jour d'un repas) ;
  - `zWeek` : une semaine, désignée par son lundi au format `YYYY-MM-DD` ;
  - `zCents` : un montant, en entier de centimes, avec une devise (`EUR` par
    défaut).

  Tout calcul relatif (« aujourd'hui », « cette semaine », une péremption
  proche, l'expansion d'une récurrence au changement d'heure) se fait dans le
  fuseau `Europe/Paris`, une constante de `contracts`.

## Toutes les erreurs ont la même enveloppe

Un filtre global produit cette enveloppe à partir des exceptions métier, des
erreurs zod et des refus de la garde d'Espace :

```json
{
  "status": 422,
  "code": "event.period_reversed",
  "message": "La fin d'un Événement ne précède pas son début.",
  "fields": [{ "path": "endsAt", "code": "too_small", "message": "…" }]
}
```

- `code` est stable, en anglais, sous la forme `<module>.<cas>`. C'est lui que
  testent les tests et que le front utilise dans sa logique.
- `message` est en français et s'affiche tel quel : le tableau de bord n'existe
  qu'en français.
- `fields` n'apparaît que pour une erreur de validation.

Les statuts :

- **400** : requête mal formée ou schéma non respecté ;
- **401** : pas de session ;
- **403** : Espace refusé par le module ;
- **404** : objet absent **ou** d'un autre Espace. On ne confirme jamais
  l'existence d'un objet qu'on ne peut pas voir ;
- **422** : règle métier violée ;
- **500** : un défaut de notre côté, jamais une réponse métier.

## Les routes

- **Le CRUD** se fait sur des noms anglais au pluriel, en kebab-case
  (`/shopping-lists`), avec au plus un niveau d'imbrication.
- **Une transition métier** est une route d'action explicite :
  `POST /<ressource>/:id/<verbe>` (`/shopping-lists/:id/close`). Quand l'action
  crée un objet du domaine, c'est un `POST` sur la collection imbriquée
  (`/meal-plans/:id/generation-rounds`). **Un statut ne se modifie jamais par
  PATCH** : le schéma du PATCH ne contient pas ce champ. Une transition a des
  préconditions et des effets de bord (clôturer une liste fait monter le stock),
  et elle ne doit pas pouvoir être contournée par la modification d'un champ.
- **Une création ou une modification** renvoie la ressource. **Une
  suppression** renvoie un 204.

## Toute liste a une borne

Il n'y a pas de pagination par défaut : les volumes sont ceux d'un foyer. En
revanche, aucune liste n'est sans borne :

- un objet daté se lit sur une **période** obligatoire (`from`, `to`) ;
- un catalogue se lit en entier, ou filtré (`?q=`) ;
- un journal en ajout seul (traces de génération IA, commandes non comprises)
  se lit par curseur : `{ items, nextCursor }`, avec une limite de 50 par
  défaut.

Les autres listes renvoient un tableau nu. Un filtre facultatif `?scopeId=` ne
fait que restreindre ce qui est déjà atteignable.

## L'Espace dans un module à Espace unique

Un module qui n'accepte qu'**un** type d'Espace, quand ce type n'a qu'une
instance atteignable (la Cuisine et l'Espace foyer), pose lui-même l'Espace à la
création. Son schéma de création ne contient pas `scopeId`. Ce n'est pas une
déduction tirée du contexte, que l'ADR 0014 refuse : c'est la déclaration du
module (`@Espaces('HOUSEHOLD')`) qui fixe l'Espace, et la garde vérifie
l'écriture comme toujours. Un module qui accepte plusieurs Espaces, comme le
Calendrier, continue d'exiger `scopeId`.

## Les écrans se préremplissent par leur URL

Tout formulaire de création ou de modification est adressable par une route, et
se préremplit à partir des paramètres de requête, validés par le schéma zod de
l'entrée (`/calendrier/evenements/nouveau?title=Dentiste&category=APPOINTMENT`).
Les URL du front sont en français, puisqu'elles s'affichent dans le navigateur.
Les paramètres gardent les noms des champs du contrat, puisque c'est son
schéma qui les valide. Un
paramètre invalide est ignoré et signalé, jamais appliqué en silence. Le
formulaire n'enregistre jamais rien de lui-même.

C'est ce qui permettra à la barre de commande d'ouvrir un écran prérempli sans
reprendre les écrans existants. Les annotations du catalogue (`@Command(...)`,
qui produira une extension `x-command` de l'OpenAPI) restent hors des tickets
de module : le catalogue grossit sur preuve d'usage (ADR 0018).

## Le front consomme l'API par des services de transport

Le front a un service par ressource, typé par `contracts`, sans règle métier,
qui ne revalide pas les réponses. Les lectures passent par `httpResource`, les
écritures par des méthodes du service. Un intercepteur unique traduit toute
erreur dans l'enveloppe ci-dessus : l'écran affiche `message`, et `fields` à
côté des champs. Le reste des conventions front (structure d'un écran,
formulaires, composants) relève de l'épique UI.

## Ce que chaque route prouve

Chaque route ajoutée vient avec des tests d'intégration sur une vraie base :

1. le cas nominal, avec une réponse conforme au schéma de sortie ;
2. un body invalide, qui donne un 400 dont `fields` pointe le bon champ ;
3. chaque règle métier de la route, qui donne un 422 avec son `code` ;
4. pour un module qui accepte un Espace personnel : l'objet de l'Espace
   personnel de l'autre utilisateur donne un 404, en lecture comme en écriture ;
5. sans session, un 401, sauf pour une route `@Public()`.

Les règles métier non triviales vivent dans les modules profonds et sont
testées en unitaire. Le test d'intégration d'une route ne fait que vérifier le
branchement.

## Options écartées

- **`class-validator` et `@nestjs/swagger`**, le standard de Nest. Ces classes à
  décorateurs ne se partagent pas proprement avec Angular : chaque contrat
  aurait existé deux fois, en classe côté API et en interface côté front.
- **Un client généré à partir de l'OpenAPI.** Avec des schémas partagés, il
  aurait fait une deuxième source de types.
- **RFC 9457 (Problem Details).** C'est la même idée sous une forme standard,
  plus verbeuse, alors que l'API n'a pas d'autre consommateur que nos deux
  applications.
- **La pagination partout.** Elle n'apporte rien à ces volumes, et chaque écran
  en aurait payé la complexité.
- **Un `scopeId` toujours envoyé, même quand une seule valeur est possible.**
  C'est conforme à la lettre de l'ADR 0014, mais chaque formulaire de la Cuisine
  aurait porté un sélecteur à une seule option.
