# Deux utilisateurs dès la V1, cloisonnés par Espace

> **Statut :** accepté — 3 août 2026
> Remplace le §6.2 de la note produit initiale, qui rangeait l'utilisateur secondaire en « futur » et son accès en phase 8.

Personal OS est une application à **deux utilisateurs de plein droit** dès la première version : chacun dispose de ses propres données privées, et certaines données sont communes au foyer. Ce n'est pas un compte principal assorti d'un accès invité.

Le cloisonnement repose sur un concept unique, l'**Espace** : trois valeurs (personnel A, personnel B, foyer), portées par chaque enregistrement. Un utilisateur voit exactement ce qui appartient à son espace personnel ou à l'espace foyer. Chaque module déclare les espaces qu'il accepte — les repas, les courses et le stock sont toujours dans l'espace foyer, les finances et les documents toujours dans un espace personnel, le calendrier accepte les deux.

## Options écartées

- **Partage décidé au niveau du module** (« le calendrier est partagé, les finances sont privées »). Le calendrier casse le modèle immédiatement : un rendez-vous médical et des vacances communes ne peuvent pas relever de la même règle.
- **Partage décidé enregistrement par enregistrement** (propriétaire + liste de partage). Granularité maximale, mais une décision de partage sur chacun des quarante écrans de création, et une seule valeur par défaut mal choisie suffit à exposer une fiche de paie — le risque explicite du §24.3.

## Conséquences

- Le filtrage par espace est une règle **unique**, appliquée au niveau de l'accès aux données et non écran par écran. C'est le point à tester en priorité (parcours §17.4-9).
- Aucun enregistrement ne peut exister sans espace, et aucun espace n'est déduit implicitement d'un contexte : il est toujours explicite.
- La V1 doit livrer ce que la note plaçait en phase 8 : création du second compte, filtrage par espace, et tests de non-exposition. Le périmètre de la §29 s'en trouve alourdi.
- **Espace** et **Visibilité** (publication au portfolio) sont deux axes distincts qui ne doivent jamais être confondus : le premier dit qui, dans le foyer, peut voir la donnée ; le second dit si elle sort sur Internet.
