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

## Ce que la garde ne couvre pas

- **Les requêtes SQL brutes.** Elles ne sont plus exposées par la façade
  `PrismaService` aux modules métier. Un accès technique dédié devra être
  introduit explicitement si une migration ou une opération d'administration
  en a besoin.
- **Les écritures imbriquées entre modèles cloisonnés.** La garde vérifie
  l'**Espace** de la charge écrite, pas celui des charges qu'elle contiendrait.
  Les chemins qui passent par un ou plusieurs modèles hors Espace sont refusés
  par liste de relations transitive. Le jour où une **Recette** portera ses
  **Ingrédients**, il faudra étendre l'inspection des charges d'un modèle
  cloisonné ; un test doit alors échouer avant la mise en production.

## Options écartées

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
