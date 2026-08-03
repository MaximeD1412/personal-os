# Rien de ce qui requiert l'attention n'est stocké

> **Statut :** accepté — 3 août 2026
> Réduit le §21 de la note produit initiale, qui décrivait un centre de notifications alimenté par des événements internes.

Il n'existe **ni entité Tâche, ni entité Notification**. Tout ce que le tableau de bord présente comme requérant l'attention de l'utilisateur — les **À faire** — est calculé à la lecture depuis l'état réel des modules : un planning dont des repas attendent une décision, une liste de courses non arrêtée, un ingrédient qui périme, une **Échéance** dont le délai de rappel est atteint.

Une « échéance » est un **Événement** portant une catégorie dédiée. Un « rappel » est un délai porté par l'**Événement**, pas un objet. Un « à faire » disparaît parce que la situation qui le produisait a changé, jamais parce qu'on l'a coché.

La raison est qu'une liste stockée de choses à faire se désynchronise systématiquement de la réalité qu'elle prétend décrire, et impose une deuxième liste concurrente sur la même page d'accueil.

## Conséquences

- Aucune tâche planifiée n'est nécessaire pour matérialiser des rappels, et il n'y a ni déduplication ni purge à écrire.
- Il n'y a pas d'état « lu / non lu », ni d'historique de ce qui a été signalé. C'est assumé.
- Cette décision devra être rouverte le jour où une notification devra **sortir** de l'application (e-mail, push) : envoyer exige de savoir ce qui a déjà été envoyé. Ce jour-là, on ajoutera une trace d'envoi — pas une liste de choses à faire.
- Les « tâches domestiques » évoquées au §6.2 n'existent nulle part dans la V1.
