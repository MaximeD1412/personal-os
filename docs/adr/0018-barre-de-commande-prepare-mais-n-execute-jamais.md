# La barre de commande prépare une action, elle ne l'exécute jamais

> **Statut :** accepté — 3 août 2026

Le tableau de bord porte un champ de texte unique où l'utilisateur décrit son intention en français. Une commande est traduite en une action applicative **préremplie et affichée** : l'écran concerné s'ouvre, les champs sont remplis, l'utilisateur confirme. **Aucune commande ne modifie de donnée sans passage par cette confirmation** — y compris les actions les plus anodines.

La règle est volontairement sans exception. Classer les actions en « anodines » et « sensibles » obligerait à maintenir cette classification à chaque nouvelle fonctionnalité, et une seule erreur de classement suffirait à ce qu'une interprétation erronée modifie des données sans que l'utilisateur l'ait vue passer. Une règle unique se teste une fois ; une liste d'exceptions se maintient pour toujours.

Le modèle choisit parmi un **catalogue fermé d'actions typées**, jamais parmi l'ensemble des endpoints. Ce catalogue n'est pas un second inventaire écrit à la main : il est **généré au build depuis les endpoints explicitement annotés**, en s'appuyant sur l'OpenAPI déjà produit par l'API. Un décorateur rend un endpoint atteignable et porte la phrase décrivant quand l'employer ; les paramètres, les types et la validation sont ceux de l'API, sans recopie ni dérive possible.

Le caractère fermé est préservé : un endpoint non annoté est invisible pour la barre. L'ouverture reste une décision explicite, prise à l'endroit où le code vit plutôt que dans un fichier parallèle.

La barre **agit et navigue, elle ne répond pas**. Une question (« combien ai-je dépensé en juillet ? ») est traitée comme une navigation vers l'écran filtré qui porte la réponse : le chiffre affiché est calculé par l'application, jamais reformulé par un modèle. Un montant inventé dans une phrase d'apparence assurée est le pire défaut possible sur des données financières ou de santé.

La barre fait partie de la V1, sur décision explicite, en connaissance de la charge déjà absorbée par ailleurs (deux comptes et cloisonnement par Espace, Authentik, tests de non-exposition, catalogue Produit, stock domestique, traçabilité IA).

## Conséquences

- Toute ambiguïté est résolue par l'utilisateur dans le formulaire, jamais devinée par le modèle : « décale le yoga de jeudi » ouvre le choix entre cette occurrence et toute la série.
- Une action du catalogue n'atteint jamais une donnée que l'utilisateur ne pourrait pas voir autrement : le filtrage par **Espace** de l'ADR 0014 s'applique inchangé, puisque l'action passe par les mêmes chemins d'accès aux données.
- Chaque écran livré après la barre demande d'annoter les endpoints correspondants. C'est un coût récurrent, assumé.
- Quand aucune action ne correspond, la barre **le dit** — elle ne se rabat jamais silencieusement sur une navigation approximative. Elle propose l'écran le plus proche et **journalise la phrase telle qu'elle a été écrite**. Ce journal est la file de travail : on n'annote de nouveaux endpoints que pour des commandes dont on a la preuve qu'elles sont tapées.
- Le catalogue démarre donc petit et grossit par la preuve d'usage, jamais par anticipation.
