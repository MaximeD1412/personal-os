# Modules plats, et filtrage par Espace centralisé dans l'accès aux données

> **Statut :** accepté — 3 août 2026
> Repousse l'application de la structure en quatre couches décrite au §9.4 de la note produit initiale, qui reste la cible.

Un module démarre **plat** : contrôleur, service, accès aux données, DTO. Pas de découpage `application` / `domain` / `infrastructure` / `presentation` tant qu'il n'y a rien à y mettre. On extrait une couche domaine module par module, uniquement là où une vraie règle apparaît — consolidation des courses, conversion d'unités, tours de génération du planning. Un module de calendrier qui ne fait que du CRUD n'a aucune raison de coûter douze fichiers et deux niveaux de correspondance d'objets.

En contrepartie, **le filtrage par Espace n'est pas laissé aux services** : il est appliqué au niveau de l'accès aux données (extension Prisma), pour toutes les requêtes, sans discipline à tenir dans chaque module. C'est le corollaire indispensable de la structure plate : plus les modules sont simples, plus la garantie de cloisonnement doit être portée par un mécanisme unique et non par la vigilance.

## Conséquences

- Le code ne ressemblera pas au §9.4 tant qu'un module n'a pas gagné à être approfondi. Ce n'est pas une dette : c'est la décision.
- Aucun service ne doit ajouter « à la main » un filtre par espace. Si l'on en trouve un, c'est le signe que le mécanisme central a été contourné.
- Le test de non-exposition (§17.4-9) porte sur le mécanisme central, pas sur chaque endpoint pris séparément.
- Contrepartie assumée : il faudra réellement approfondir quand la règle arrive, au lieu de laisser grossir un service.
