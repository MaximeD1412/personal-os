# La portée d'Espace est ouverte par requête, et rien de cloisonné ne s'écrit hors d'elle

> **Statut :** accepté — 27 août 2026
> Met en œuvre l'[ADR 0016](0016-modules-plats-et-filtrage-espace-centralise.md),
> qui pose le filtrage centralisé sans dire par quel chemin l'**Espace** atteint
> l'accès aux données.

Le filtrage par **Espace** vit dans une extension Prisma, posée sur le seul
client que `packages/database` exporte. Il n'existe pas de client nu ailleurs :
il n'y a donc rien à contourner, et aucun service n'a de filtre à écrire.

Ce que l'extension a besoin de savoir — les **Espaces** du **Compte** connecté,
et ceux que le module traversé accepte — voyage dans un `AsyncLocalStorage`,
pas dans les signatures. C'est ce qui permet aux modules de rester plats : un
dépôt appelle `prisma.trace.findMany()` sans rien passer, et la garde ajoute le
sien.

Le porte-portée est ouvert **vide** par un middleware, au tout début de la
requête, avant qu'on sache qui la présente. Un intercepteur y pose la portée
une fois la session lue. C'est un intercepteur et non une garde parce que Nest
les exécute après toutes les gardes : l'ordre d'enregistrement des gardes
globales ne peut donc pas le désynchroniser de la session.

Trois règles en découlent, et elles sont ce qu'on achète :

- **Une requête cloisonnée sans portée échoue**, bruyamment. Un module qui
  oublie de déclarer ses **Espaces** rend une erreur 500, pas une liste vide :
  un cloisonnement silencieusement total ressemble trop à une réponse.
- **Une création sans Espace est refusée.** Une modification, elle, n'a pas à
  le répéter — le filtre l'a déjà bornée aux rangées atteignables ; mais si elle
  le nomme, c'est qu'elle déplace l'enregistrement, et cela se vérifie.
- **Tout modèle est cloisonné par défaut.** La liste `MODELES_HORS_ESPACE`
  énumère les exceptions, et un test la relit contre `schema.prisma` : un modèle
  nouveau est protégé sans que personne n'y pense, exactement comme une route
  est fermée sans rien faire ([ADR 0026](0026-session-en-base-et-api-fermee-par-defaut.md)).

Le filtre s'ajoute par `AND` plutôt qu'en fusionnant à la racine du `where`. Les
champs uniques restent donc à leur place, et `findUnique`, `update` et `delete`
continuent de fonctionner tout en étant bornés : deviner un identifiant ne
rapporte rien, et la réponse est « introuvable » plutôt qu'« interdit », pour ne
pas confirmer l'existence de la rangée.

## Les écritures imbriquées

> **Complété le 19 octobre 2026 par SOCLE-6 (#68).** Cette section remplace
> le paragraphe qui laissait les écritures imbriquées hors de la garde — « le
> jour où une **Recette** portera ses **Ingrédients**, il faudra étendre
> l'inspection » —, et son complément de #9, qui les interdisait toutes entre
> modèles cloisonnés par une liste tenue à la main (`RELATIONS_CLOISONNEES`).

**Toute table cloisonnée porte `scopeId`**, lignes d'agrégat comprises : une
ligne de **Recette** a le même `scopeId` que sa **Recette**. Il n'y a pas de
modèle « dépendant » sans **Espace** : l'uniformité prime sur la redondance,
et le filtre s'applique partout.

Une écriture imbriquée ne traverse pas l'extension pour chaque modèle qu'elle
atteint. La garde la suit donc à toute profondeur, le long des relations que
le client Prisma déclare à l'exécution (son DMMF), et non d'une liste tenue à
la main : un modèle nouveau est couvert sans que personne y pense. Dans une
écriture sur un modèle cloisonné :

- vers un **autre modèle cloisonné**, seuls `create` et `createMany`
  passent. La ligne créée est dans l'**Espace** de son parent : une ligne
  qui en nomme un autre, par `scopeId` ou par sa relation à l'**Espace**, est
  refusée. La clé étrangère qui relie deux modèles cloisonnés porte `scopeId`
  des deux côtés (`modeles.spec.ts` le vérifie) : Prisma tire donc l'**Espace**
  de la ligne de celui de son parent — et refuse qu'on le répète —, et la base
  rejette tout écart. Une ligne d'un **Événement** en suit la série quand
  celle-ci change d'**Espace**. Sous une modification qui ne nomme pas
  l'**Espace** de son parent, la garde ne le connaît pas : une ligne créée n'y
  nomme donc aucun **Espace**, et la clé étrangère lui donne celui du parent.
  Une ligne qui en nommerait un pourrait déplacer son parent — créée du côté
  que vise sa clé étrangère, elle lui imposerait son `scopeId` ;
- `connect`, `connectOrCreate`, `set`, `update`, `updateMany`, `upsert`,
  `delete`, `deleteMany` et `disconnect` vers un modèle cloisonné sont
  refusés : ces gestes se font au premier niveau, par le dépôt du modèle
  concerné, où la garde les borne ;
- vers un **modèle hors Espace** (un **Ingrédient** du catalogue), on
  rattache (`connect`, `disconnect`, `set`) sans rien y écrire. La relation
  à l'**Espace** lui-même ne fait que rattacher un **Espace** par son
  identifiant, que la garde vérifie comme un `scopeId`.

Depuis un modèle hors Espace, les chemins qui atteignent une donnée
cloisonnée, directement ou à travers d'autres modèles hors Espace, restent
refusés par la liste `RELATIONS_VERS_ESPACE`, relue contre le schéma.

Ces refus sont un défaut du module, pas de la requête : raison
`imbrication`, rendue en 500 `scope.nested_write`.

## Ce que la garde ne couvre pas

- **Les requêtes SQL brutes.** Elles ne sont plus exposées par la façade
  `PrismaService` aux modules métier. Un accès technique dédié devra être
  introduit explicitement si une migration ou une opération d'administration
  en a besoin. Une règle de lint de l'API (`packages/api/eslint.config.mjs`)
  refuse le SQL brut et tout import de `@prisma/*` ou du client généré, sans
  exception.

## Options écartées

- **Que la garde pose `scopeId` sur chaque ligne imbriquée.** Prisma refuse
  ce champ sur une ligne dont la clé étrangère vers son parent le porte
  déjà : il le tire lui-même du parent. La clé composite donne la même
  garantie, tenue par la base ; la garde se contente de refuser une ligne qui
  nommerait un autre **Espace**.
- **Filtrer dans chaque service.** C'est exactement ce que l'ADR 0016 refuse :
  la garantie dépendrait de la vigilance, et un seul oubli sur quarante écrans
  suffirait.
- **`enterWith` plutôt qu'un middleware.** Une ligne de moins, mais le contexte
  déborde alors sur le reste du tour de boucle de la ressource asynchrone. Le
  porte-portée mutable est plus long à expliquer et plus court à raisonner.
- **Row-level security PostgreSQL.** La garantie descendrait sous l'application,
  ce qui est séduisant. Mais elle demanderait une connexion par utilisateur, ou
  un `SET LOCAL` par requête que le pool rendrait fragile — et le message
  d'erreur ne dirait plus quel module a fauté.
- **Un client Prisma nu exporté à côté du client cloisonné**, pour l'amorçage et
  les tests. C'est l'échappatoire qu'on a refusé d'ouvrir : le jeu de données de
  test passe par une portée comme tout le monde.
