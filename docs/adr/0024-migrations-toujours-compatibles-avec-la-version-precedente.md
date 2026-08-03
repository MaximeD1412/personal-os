# Les migrations restent toujours compatibles avec la version précédente

> **Statut :** accepté — 3 août 2026
> Précise ce que signifie le « rollback documenté » du §18.

Une migration **n'enlève jamais ce que la version précédente utilise encore**. On ajoute, on remplit, on lit ; on ne supprime qu'à une livraison ultérieure, quand plus aucun code déployé ne dépend de l'ancienne forme. Une suppression de colonne prend donc au minimum deux livraisons.

La conséquence est que **revenir en arrière consiste uniquement à remettre les images précédentes**. On ne touche jamais à la base, et aucune donnée saisie depuis le déploiement n'est perdue. C'est ce qui rend le retour arrière réellement utilisable — donc réellement utilisé — dans un déploiement automatique ([ADR 0023](0023-deploiement-automatique-tire-par-le-vps.md)).

## Options écartées

- **Migrations descendantes écrites pour chaque migration.** Modèle mental symétrique et rassurant, mais l'inverse d'une suppression ne restitue pas les données supprimées, l'inverse d'une transformation est approximatif, et cette migration descendante n'est jamais exercée : elle serait exécutée pour la première fois le jour de l'incident.
- **Retour arrière par restauration de la sauvegarde.** Aucune contrainte sur l'écriture des migrations, mais tout ce qui a été saisi depuis le déploiement disparaît. Un bug découvert une heure après la livraison coûterait une heure de repas cuisinés, d'articles cochés et d'événements créés.

## Conséquences

- Un renommage se fait en trois temps : ajouter la nouvelle forme et écrire dans les deux, basculer les lectures, supprimer l'ancienne.
- Une migration qui casserait la version précédente est un défaut de conception, pas un cas particulier à négocier.
- Cette règle est aussi ce qui permettra un redémarrage sans interruption si le besoin apparaît.
