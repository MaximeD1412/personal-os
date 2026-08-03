# La liste de courses est figée à l'édition

> **Statut :** accepté — 3 août 2026

Produire une liste de courses est un acte explicite qui en fige le contenu. Une fois arrêtée, la liste n'est plus jamais recalculée : les modifications ultérieures du planning de repas ne la touchent pas. Le système détecte l'écart, le signale, et propose de générer une **liste complémentaire** contenant uniquement le delta.

La raison est que la liste quitte le système dès qu'elle est produite : elle part au magasin, où elle est cochée, annotée et complétée à la main. Un recalcul automatique ferait disparaître un article déjà mis dans le caddie ou baisser une quantité déjà achetée — le système contredirait la réalité pendant que l'utilisateur est devant le rayon.

## Conséquences

- Une liste porte un état explicite (en préparation, arrêtée, terminée) et conserve les quantités telles qu'elles étaient au moment de l'arrêt.
- Les cochages et les ajouts manuels sont préservés en toutes circonstances : aucun traitement automatique ne les efface.
- Contrepartie assumée : on peut acheter pour un repas finalement annulé. C'est le prix d'une liste sur laquelle on peut compter.
- Ceci n'est pas un bug : si une liste ne reflète pas le planning courant, c'est le comportement voulu.
