# Le stock domestique est quantitatif et déclaratif

> **Statut :** accepté — 3 août 2026

Le stock domestique tient de **vraies quantités** par ingrédient, et **tout ce qui est acheté y entre**. Il est explicitement déclaratif : il représente ce que l'utilisateur a déclaré, pas une vérité garantie. On accepte qu'il soit parfois faux, à condition qu'il soit facile à corriger.

Il se recale par trois voies : la clôture d'une liste de courses (entrée de la quantité réellement achetée, déduite du conditionnement du **Produit** et non du besoin de la recette), la déclaration d'un **Repas cuisiné** avec les quantités réellement utilisées, et un écran de stock directement éditable.

Le bénéfice recherché est la réutilisation : ce qui reste d'une semaine alimente la génération du planning de la suivante, et une date de péremption proche permet de privilégier — ou d'écarter — un ingrédient au moment de proposer des repas.

## Options écartées

- **Ne suivre que les denrées explicitement marquées** (épicerie sèche, conserves). Stock petit et fiable, mais aucun reste périssable ne remonte à la génération du planning — ce qui était précisément le but.
- **Décrément automatique quand la date d'un repas planifié est passée.** Aucun geste quotidien, mais chaque repas pris à l'extérieur crée un écart silencieux, toujours dans le même sens.
- **Aucun stock quantitatif**, remplacé par une revue « j'en ai déjà » au moment d'arrêter la liste. Plus léger, mais ne permet ni la réutilisation entre semaines, ni la gestion des péremptions.

## Conséquences

- L'écran de stock n'est pas un écran d'administration : c'est un écran d'usage courant, qui doit permettre de corriger une quantité en quelques secondes.
- Une seule ligne de stock par ingrédient. En cas de rachat, la date de péremption conservée est la plus proche — on n'introduit pas de gestion de lots.
- La déclaration d'un **Repas cuisiné** demande les quantités réelles, pas celles de la recette : c'est le mécanisme d'auto-correction principal.
- Un stock faux est un incident normal, pas un bug. Le remède est l'édition manuelle, jamais un recalcul automatique.
