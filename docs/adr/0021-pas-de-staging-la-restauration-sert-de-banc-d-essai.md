# Pas de staging : la restauration sert de banc d'essai aux migrations

> **Statut :** accepté — 3 août 2026
> Répond à la question laissée ouverte au §30 (« définition des environnements local, staging et production »).

Il n'existe que **deux environnements** : le poste local, avec la pile Compose complète et un jeu de données de démonstration généré, et la production sur le VPS OVH.

Un staging aurait vécu sur la même machine que la production — ressources doublées, configuration doublée, et un environnement qui dérive jusqu'à ne plus rien prouver.

À la place, **toute migration est répétée sur une restauration de la sauvegarde de production**, dans un conteneur jetable, avant d'être déployée. Si la migration échoue là, elle n'est pas déployée.

L'intérêt est que ce geste teste deux choses à la fois : la migration **et** la sauvegarde. La procédure de restauration exigée au §15.5 cesse d'être un exercice trimestriel qu'on oublie de faire, pour devenir une étape du chemin normal de livraison.

## Conséquences

- Il n'y a aucun endroit pour faire vivre une fonctionnalité avant de la livrer. C'est assumé : l'utilisateur et le développeur sont la même personne.
- Une migration non testable de cette façon (parce qu'elle dépend de données de production absentes du dump, par exemple) est un signal d'alerte, pas un cas particulier à contourner.
- Le jeu de données de démonstration local doit rester représentatif — notamment sur les **Espaces**, sans quoi le cloisonnement n'est jamais exercé en développement.
