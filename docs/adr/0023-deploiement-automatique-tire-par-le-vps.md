# Déploiement automatique, tiré par le VPS

> **Statut :** accepté — 3 août 2026
> Remplace le §13.5 de la note produit initiale, qui prévoyait un déclenchement manuel par SSH.

Un commit atteignant la **branche principale** part en production. La branche principale est donc une branche de **livraison** : le travail se fait sur des branches, et fusionner signifie livrer.

L'exécution est **tirée, jamais poussée**. GitHub Actions construit, teste et pousse les images sur GHCR, et s'arrête là : il n'a **aucun accès entrant** au VPS. Un agent sur le VPS détecte la nouvelle version et exécute la séquence localement :

1. restauration de la dernière sauvegarde dans un conteneur jetable ;
2. répétition de la migration sur cette copie — en cas d'échec, on s'arrête, la production n'a pas bougé ([ADR 0021](0021-pas-de-staging-la-restauration-sert-de-banc-d-essai.md)) ;
3. récupération des images, migration réelle, redémarrage ;
4. vérification de santé, et retour aux images précédentes si elle échoue.

La raison du sens « tiré » est que la séquence manipule la **restauration d'une sauvegarde de données personnelles**. Les identifiants Restic et la clé de déchiffrement ne doivent jamais quitter la machine, et aucune clé d'accès permanente à la production ne doit résider chez un tiers — le VPS héberge fiches de paie, finances et documents immobiliers.

## Options écartées

- **GitHub se connecte en SSH au VPS.** Montage le plus répandu et le plus rapide, mais une clé d'accès permanente à la production réside alors chez GitHub, exposée à toute compromission du compte ou d'une action tierce du workflow.
- **Répétition de la migration dans le runner GitHub.** Isolation parfaite du test, mais suppose de confier la clé de déchiffrement Restic à un tiers et de déchiffrer des documents personnels sur une machine partagée. Contredit frontalement les §3.1 et §12.

## Conséquences

- Le résultat d'un déploiement n'apparaît pas dans l'interface GitHub. L'agent doit produire une trace lisible sur le VPS, et signaler ses échecs (§16.1).
- L'agent de déploiement fait partie du produit : il est versionné dans le dépôt, et sa panne est un incident au même titre qu'une panne applicative.
- Fusionner sur la branche principale n'est jamais anodin. Il n'y a pas de « je pousse pour sauvegarder mon travail » sur cette branche.
