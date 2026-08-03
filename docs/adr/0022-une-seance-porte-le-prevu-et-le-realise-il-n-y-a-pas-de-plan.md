# Une Séance porte le prévu et le réalisé, et il n'existe pas de Plan

> **Statut :** accepté — 3 août 2026
> Retire du périmètre les entités `TrainingPlan`, `TrainingWeek` et `TrainingResult` du §19.

Le module sport tient sur deux objets seulement.

Une **Séance** porte à la fois ce qui était prévu et ce qui a été réalisé, plus un statut. Une sortie non planifiée est une séance créée déjà réalisée, sans prévu ; une séance manquée conserve son prévu et reste sans réalisé. L'écart entre les deux se lit champ par champ, sans jointure, et l'agenda n'a jamais à choisir entre deux objets à afficher pour le même jour.

Un **Objectif** — une course, une date, une intention — remplace la notion de plan. Il n'existe ni plan, ni semaine d'entraînement : le plan est l'ensemble des séances qui mènent à l'objectif. Quand une semaine saute pour cause de maladie ou d'imprévu, il n'y a aucune structure à recalculer ni à décaler : on marque les séances non faites et on ajuste les suivantes.

## Options écartées

- **Séance prévue immuable + Résultat séparé.** Donne une vraie mesure d'observance dans la durée, mais impose deux entités, une jointure, et la question permanente de savoir laquelle l'agenda affiche.
- **Plan structuré en semaines et en phases**, avec charge cible. Permet de décaler un bloc entier d'un geste et de réutiliser une préparation, mais ajoute trois entités et le problème d'une séance déplacée hors de sa semaine — alors que la date de la course, elle, ne bouge pas.

## Conséquences

- Il n'y a pas de charge hebdomadaire cible calculée, ni de comparaison automatique entre volume prévu et volume réalisé sur une semaine. Ces chiffres restent dérivables des séances si le besoin apparaît.
- Aucun modèle de plan réutilisable d'une préparation à l'autre. Créer une nouvelle préparation, c'est créer des séances — éventuellement en série.
- L'adaptation automatique du plan évoquée au §7.3 n'a plus d'objet sur lequel s'appliquer. Si elle revient, elle agira sur les séances à venir.
