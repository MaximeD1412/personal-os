# Les objets datés appartiennent à leur module ; l'agenda est une vue agrégée

> **Statut :** accepté — 3 août 2026
> Les numéros 001 à 010 sont déjà occupés par les décisions de stack listées au §25 de la note produit initiale.

Cinq modules produisent des objets qui ont une date (Événement, Séance, Repas planifié, et plus tard échéances immobilières et financières), et le tableau de bord doit tous les afficher. Nous ne créons **pas** de table `Event` générique : chaque module possède son entité, avec ses propres attributs et son propre cycle de vie, et rien ne référence l'entité d'un autre module.

L'agenda et le tableau de bord sont des vues en lecture seule. Elles sont composées par **inversion de dépendance** : un contrat `AgendaContributor` vit dans les contrats partagés, chaque module l'implémente et s'enregistre, et le module Agenda ne connaît aucun domaine. Ajouter un module qui doit apparaître à l'agenda ne modifie donc pas l'agenda.

## Options écartées

- **Une table `Event` unique avec un type et un payload JSON.** Rend le calendrier trivial, mais force chaque module à encoder ses attributs propres (allure, zones cardiaques, portions, recette) hors du typage, et transforme cette table en point de couplage de tout le système.
- **Entités propres + `Event` miroir synchronisé.** Double écriture, désynchronisation possible, et une question sans bonne réponse : que se passe-t-il quand on déplace le miroir ?
- **Composition directe** (le module Agenda importe les services des domaines). Plus simple à 3 contributeurs, mais chaque nouveau module aurait modifié l'agenda.

## Conséquences

- `AgendaItem` doit rester un contrat **étroit** : source, identité d'origine, date, intitulé, statut. Il ne porte aucun attribut métier — l'agenda affiche des références, pas des objets.
- Les widgets hétérogènes du tableau de bord (solde budgétaire, articles restants, état de sauvegarde) ne passent **pas** par ce port. Chaque module expose son propre endpoint de résumé et le front compose des composants dédiés. Un port unique aurait produit un type union grossissant à chaque besoin d'affichage.
- L'agenda ne permet aucune écriture. Déplacer une séance se fait dans le module Sport.
