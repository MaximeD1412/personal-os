# PRD — Personal OS V1

> Copied from issue #1 on 2026-11-05, unchanged (stage 1 of the process,
> skill `product-design`): the PRD now lives here, versioned with the code;
> the issue keeps a link. It is still in French and has no `US-<n>` story IDs:
> the next feature designed with `product-design` goes to
> `docs/product/features/<slug>.md` and gives its stories IDs.

Ce PRD décrit l'intégralité de la V1 de Personal OS. Il s'appuie sur le glossaire [`CONTEXT.md`](../../CONTEXT.md) et sur les ADR [`docs/adr/`](../adr), qui font autorité. La note produit initiale est antérieure aux ADR et est contredite sur plusieurs points ; elle porte des renvois explicites.

## Problem Statement

Ma vie personnelle et professionnelle est éparpillée : ce qui a une date vit dans un agenda, les repas de la semaine se décident de tête ou sur un papier, la liste de courses se refait à chaque fois sans savoir ce qui reste dans les placards, les projets et leur présentation publique n'existent nulle part, et le portfolio public n'existe pas du tout. Ma compagne et moi partageons la vie du foyer mais pas nos affaires personnelles, et aucun outil existant ne fait ce partage sans exposer trop ou trop peu.

Concrètement :

- Je ne vois nulle part, en un seul écran, ce qui m'attend cette semaine : rendez-vous, séances de sport, repas prévus, échéances administratives.
- Chaque semaine, décider des repas repart de zéro : sans mémoire des recettes appréciées, sans tenir compte des préférences et allergies de chacun, sans savoir ce qui reste du samedi précédent.
- La liste de courses est reconstruite à la main, les quantités ne se consolident pas (200 g ici, 3 pièces là), et une fois au magasin toute modification du planning la rend fausse.
- Ce qui reste après les courses se perd : des ingrédients périment sans que rien ne le signale, et rien ne les réutilise la semaine suivante.
- Mes données sensibles (finances, documents) et celles de ma compagne doivent être cloisonnées de façon fiable, sans devoir y penser à chaque création d'enregistrement.
- Je n'ai pas de portfolio, et je ne veux pas d'un site qui soit une transcription automatique de mon CV.

## Solution

Une application web privée, hébergée sur mon VPS, qui centralise tout cela pour **deux utilisateurs de plein droit** et publie un **Portfolio** bilingue.

Le cœur du produit :

1. **Un tableau de bord** qui répond à « qu'est-ce qui m'attend ? » et « qu'est-ce qui requiert mon attention ? ». Les **À faire** y sont **calculés** à la lecture depuis l'état réel des modules — rien n'est stocké, rien ne se coche.
2. **Une barre de commande** en haut de ce tableau de bord : j'écris mon intention en français, l'application ouvre l'écran concerné **prérempli**, et je confirme. Elle ne modifie jamais rien sans confirmation et ne répond jamais par une phrase — elle agit et elle navigue.
3. **Un Agenda** en lecture seule qui fusionne **Événements**, **Séances** et **Repas planifiés**, chaque module restant propriétaire de ses objets datés.
4. **Une chaîne alimentation complète** : génération IA du **Planning de repas** par **Tours de génération** en tenant compte des **Préférences alimentaires** des **Participants**, des **Souhaits** et du **Stock domestique** ; production d'une **liste de courses** consolidée en **Unité canonique** ; clôture de la liste qui fait monter le stock ; déclaration d'un **Repas cuisiné** qui le fait baisser.
5. **Un cloisonnement par Espace** : chaque enregistrement porte son **Espace** (personnel A, personnel B, foyer), et le filtrage est appliqué une seule fois, au niveau de l'accès aux données.
6. **Un Portfolio** public bilingue, **rédigé** et non généré, alimenté par des **Pages de contenu** et par les **Présentations publiques** des **Projets** publiés, plus un **CV** PDF téléversé.

Le tout se déploie automatiquement : un commit sur la branche principale part en production, l'exécution étant **tirée** par le VPS.

## User Stories

### Accès, comptes et cloisonnement

1. En tant qu'utilisateur, je veux me connecter via Authentik et retrouver ma session sans me réauthentifier à chaque visite, afin d'utiliser l'application au quotidien sans friction.
2. En tant qu'utilisateur, je veux que ma session soit un cookie serveur `HttpOnly`, afin qu'un jeton ne traîne jamais dans le navigateur.
3. En tant qu'utilisateur, je veux qu'aucune inscription ne soit ouverte, afin que seuls les deux comptes créés à la main existent.
4. En tant qu'utilisateur, je veux qu'à la création de tout enregistrement son **Espace** soit explicite, afin qu'une donnée personnelle ne se retrouve jamais dans l'**Espace foyer** par défaut mal choisi.
5. En tant qu'utilisateur, je veux ne jamais voir un enregistrement de l'**Espace personnel** de l'autre utilisateur, quel que soit l'écran ou l'endpoint emprunté, afin que la confiance dans le cloisonnement soit totale.
6. En tant qu'utilisateur, je veux voir les données de l'**Espace foyer** partagées avec l'autre utilisateur, afin que repas, courses et stock soient réellement communs.
7. En tant qu'utilisateur, je veux qu'un module refuse un **Espace** qu'il n'accepte pas (un repas ne peut pas être personnel), afin que le modèle reste cohérent.
8. En tant qu'utilisateur, je veux choisir l'**Espace** d'un **Événement** à sa création, afin de distinguer un rendez-vous médical de vacances communes.

### Tableau de bord et À faire

9. En tant qu'utilisateur, je veux voir sur la page d'accueil ce qui m'attend dans les prochains jours, afin de m'organiser d'un coup d'œil.
10. En tant qu'utilisateur, je veux voir les **À faire** calculés (planning en attente de décision, liste non arrêtée, ingrédient qui périme, **Échéance** proche), afin de savoir ce qui requiert mon attention.
11. En tant qu'utilisateur, je veux qu'un **À faire** disparaisse dès que la situation qui le produisait a changé, afin de ne jamais entretenir une liste parallèle à la réalité.
12. En tant qu'utilisateur, je veux des widgets de résumé par module (articles restants, prochaine séance, état de sauvegarde), afin d'avoir un état de santé global.

### Barre de commande

13. En tant qu'utilisateur, je veux écrire mon intention en français dans un champ unique en haut du tableau de bord, afin d'éviter la navigation.
14. En tant qu'utilisateur, je veux que la commande ouvre l'écran concerné avec les champs préremplis, afin de relire avant de valider.
15. En tant qu'utilisateur, je veux qu'**aucune** commande ne modifie de donnée sans ma confirmation, y compris les plus anodines, afin qu'une interprétation erronée ne passe jamais inaperçue.
16. En tant qu'utilisateur, je veux qu'une question (« combien ai-je dépensé en juillet ? ») ouvre l'écran filtré qui porte la réponse, afin que le chiffre affiché soit calculé par l'application et jamais reformulé par un modèle.
17. En tant qu'utilisateur, je veux qu'une ambiguïté (« décale le yoga de jeudi » : cette occurrence ou toute la série ?) me soit posée dans le formulaire, afin qu'elle ne soit jamais devinée.
18. En tant qu'utilisateur, je veux que la barre me dise franchement quand aucune action ne correspond et me propose l'écran le plus proche, afin de ne jamais être promené dans une navigation approximative.
19. En tant qu'utilisateur, je veux que la phrase non comprise soit journalisée telle que je l'ai écrite, afin que le catalogue grossisse sur preuve d'usage.
20. En tant que développeur, je veux que le catalogue d'actions soit **généré au build** depuis les endpoints explicitement annotés, afin qu'il ne dérive jamais de l'API réelle.
21. En tant que développeur, je veux qu'un endpoint non annoté soit invisible pour la barre, afin que l'ouverture reste une décision explicite.
22. En tant qu'utilisateur, je veux qu'une action de la barre n'atteigne jamais une donnée que je ne pourrais pas voir autrement, afin que le cloisonnement par **Espace** s'applique inchangé.

### Calendrier et Agenda

23. En tant qu'utilisateur, je veux créer un **Événement** daté avec un intitulé, une période et une catégorie, afin de tenir mon calendrier.
24. En tant qu'utilisateur, je veux marquer un **Événement** comme **Échéance** via une catégorie dédiée, afin qu'il remonte dans les **À faire**.
25. En tant qu'utilisateur, je veux poser un délai de rappel sur un **Événement**, afin d'être averti à l'avance sans qu'un objet « rappel » existe.
26. En tant qu'utilisateur, je veux définir un **Événement** récurrent par une règle, afin de ne pas ressaisir un rendez-vous hebdomadaire.
27. En tant qu'utilisateur, je veux modifier ou supprimer **une seule occurrence** d'une série, afin de gérer une exception sans casser la règle.
28. En tant qu'utilisateur, je veux que les occurrences soient calculées à la lecture, afin qu'un changement de règle se reflète immédiatement sans régénération.
29. En tant qu'utilisateur, je veux voir dans l'**Agenda** mes **Événements**, mes **Séances** et les **Repas planifiés** d'une période, afin d'avoir une seule ligne du temps.
30. En tant qu'utilisateur, je veux que l'**Agenda** soit en lecture seule, afin de savoir sans hésiter que chaque objet se modifie dans son module.
31. En tant que développeur, je veux qu'ajouter un module qui apparaît à l'agenda ne modifie pas le module Agenda, afin que la composition reste par inversion de dépendance.

### Sport

32. En tant qu'utilisateur, je veux créer une **Séance** avec ce qui est prévu (distance, durée, intention d'allure), afin de préparer ma semaine.
33. En tant qu'utilisateur, je veux compléter la même **Séance** avec ce qui a été réalisé, afin que l'écart se lise champ par champ sans second objet.
34. En tant qu'utilisateur, je veux enregistrer une sortie non planifiée comme **Séance** créée déjà réalisée, afin que rien ne manque à l'historique.
35. En tant qu'utilisateur, je veux marquer une **Séance** manquée en conservant son prévu, afin de garder trace de ce qui n'a pas été fait.
36. En tant qu'utilisateur, je veux définir un **Objectif** (course, date, intention), afin que mes séances aient une direction, sans entité « plan ».
37. En tant qu'utilisateur, je veux créer des **Séances** en série vers un **Objectif**, afin de préparer une échéance sans modèle de plan réutilisable.

### Alimentation — Ingrédients, Recettes, Planning

38. En tant qu'utilisateur, je veux un catalogue d'**Ingrédients** canoniques portant chacun une **Unité canonique**, afin que les quantités se consolident toujours.
39. En tant qu'utilisateur, je veux qu'un libellé libre soit rattaché à un **Ingrédient** par un **Alias**, afin que le système ne me redemande jamais deux fois.
40. En tant qu'utilisateur, je veux valider une fois pour toutes un facteur de conversion à la pièce (poids moyen d'un oignon), afin qu'une recette en pièces et une autre en grammes s'additionnent.
41. En tant qu'utilisateur, je veux que deux libellés qui ne se cuisinent ni ne s'achètent pareil soient deux **Ingrédients** distincts, afin que la liste de courses soit juste.
42. En tant qu'utilisateur, je veux saisir mes propres **Recettes** (ingrédients en quantités, étapes, portions de référence), afin de garder ce que je sais faire.
43. En tant qu'utilisateur, je veux sauvegarder une recette générée que nous avons appréciée, afin qu'elle revienne.
44. En tant qu'utilisateur, je veux déclarer mes **Préférences alimentaires** et celles de ma compagne — allergie, aliment exclu, aliment peu apprécié —, afin que la génération en tienne compte.
45. En tant qu'utilisateur, je veux qu'une allergie ne soit jamais contournée alors qu'une aversion peut l'être, afin que la distinction soit respectée.
46. En tant qu'utilisateur, je veux déposer des **Souhaits** avant la génération d'une semaine, afin que le planning les honore.
47. En tant qu'utilisateur, je veux déclencher la génération IA du **Planning de repas** d'une semaine, afin de ne plus décider de tête.
48. En tant qu'utilisateur, je veux que la génération tienne compte du **Stock domestique**, en privilégiant ce qui reste et ce qui périme bientôt, afin de limiter le gaspillage.
49. En tant qu'utilisateur, je veux statuer sur **chacun** des repas proposés — approuvé ou refusé —, afin qu'aucun ne reste dans les limbes.
50. En tant qu'utilisateur, je veux qu'un nouveau **Tour de génération** ne régénère que les repas refusés, afin de ne pas perdre ce que j'ai déjà approuvé.
51. En tant qu'utilisateur, je veux que le planning soit arrêté quand tous les repas sont approuvés, afin de savoir quand passer aux courses.
52. En tant qu'utilisateur, je veux définir les **Participants** d'un **Repas planifié**, le **Foyer** entier par défaut, afin que les portions et les préférences appliquées soient les bonnes.
53. En tant qu'utilisateur, je veux que l'aversion d'un absent ne s'applique pas à un repas où il n'est pas **Participant**, afin de ne pas m'interdire un plat sans raison.
54. En tant qu'utilisateur, je veux retrouver la trace de ce qui a été généré par l'IA (prompt, modèle, tour), afin de comprendre une proposition étrange.

### Alimentation — Courses, Produits, Stock

55. En tant qu'utilisateur, je veux produire une liste de courses à partir du **Planning de repas** arrêté, afin de ne rien oublier.
56. En tant qu'utilisateur, je veux que les besoins de plusieurs recettes soient consolidés par **Ingrédient** en **Unité canonique**, afin d'avoir une ligne par ingrédient.
57. En tant qu'utilisateur, je veux que le **Stock domestique** soit déduit du besoin, afin de ne pas racheter ce que j'ai déjà.
58. En tant qu'utilisateur, je veux qu'une liste produite soit **figée** : une modification ultérieure du planning ne la change jamais, afin que ce que je lis au magasin reste stable.
59. En tant qu'utilisateur, je veux que l'application signale l'écart quand le planning a changé après la production de la liste, et me propose une liste de complément, afin de ne pas rater un ingrédient.
60. En tant qu'utilisateur, je veux que mes articles cochés et mes ajouts manuels ne soient jamais écrasés, afin que mon travail au magasin soit intouchable.
61. En tant qu'utilisateur, je veux ajouter un article à la main à la liste (hors planning), afin d'acheter ce qui n'a rien à voir avec les repas.
62. En tant qu'utilisateur, je veux associer un **Produit** (marque, conditionnement, forme) à un **Ingrédient** et en désigner un préféré, afin que la ligne affiche « 2 boîtes » plutôt que « 800 g ».
63. En tant qu'utilisateur, je veux qu'un **Article de courses** sans **Produit** reste parfaitement valide, afin de ne pas être forcé à renseigner un catalogue complet.
64. En tant qu'utilisateur, je veux cocher les articles au fur et à mesure dans le magasin, afin de suivre où j'en suis.
65. En tant qu'utilisateur, je veux clôturer une liste et que le **Stock domestique** monte des quantités **réellement achetées** (déduites du conditionnement du **Produit**), afin que le stock reflète ce qui est rentré.
66. En tant qu'utilisateur, je veux qu'on me demande une date de péremption pour un ingrédient périssable, afin que le système sache quand le mettre en avant.
67. En tant qu'utilisateur, je veux déclarer un **Repas cuisiné** en saisissant les quantités **réellement** utilisées, afin que le stock se recale sur la réalité et non sur la recette.
68. En tant qu'utilisateur, je veux un écran de **Stock domestique** directement éditable en quelques secondes, afin de corriger une quantité fausse sans cérémonie.
69. En tant qu'utilisateur, je veux une seule ligne de stock par **Ingrédient**, conservant la date de péremption la plus proche, afin d'éviter toute gestion de lots.
70. En tant qu'utilisateur, je veux être averti quand un ingrédient approche de sa péremption, afin de le cuisiner avant de le jeter.
71. En tant qu'utilisateur, je veux que les restes d'une semaine alimentent la génération de la suivante, afin que la boucle serve réellement à quelque chose.

### Projets et Portfolio

72. En tant qu'utilisateur, je veux créer un **Projet** avec ses notes, ses liens et ses dépenses dans mon **Espace personnel**, afin de suivre mon travail.
73. En tant qu'utilisateur, je veux rédiger une **Présentation publique** par langue pour un **Projet**, distincte de mes notes privées, afin de choisir précisément ce qui sort.
74. En tant qu'utilisateur, je veux faire passer un contenu publiable par les états non publié → prêt à publier → publié, afin de contrôler la mise en ligne.
75. En tant qu'utilisateur, je veux qu'un **Projet** publié reste dans mon **Espace personnel**, afin que publication et partage dans le foyer restent deux axes distincts.
76. En tant qu'utilisateur, je veux rédiger les **Pages de contenu** du portfolio (présentation, expériences, compétences) en français et en anglais depuis le tableau de bord, afin que le site soit de la prose et non une liste d'objets.
77. En tant qu'utilisateur, je veux téléverser mon **CV** en PDF et que l'application se contente de le servir, afin de le rédiger où je veux.
78. En tant que visiteur, je veux que le **Portfolio** s'ouvre dans ma langue déduite de mon navigateur, afin de lire sans manipulation.
79. En tant que visiteur, je veux un sélecteur de langue toujours visible et mon choix mémorisé, afin de changer d'avis.
80. En tant que visiteur, je veux ne voir que des contenus à l'état « publié », afin qu'aucun brouillon ne fuite.
81. En tant qu'utilisateur, je veux qu'un projet sans présentation anglaise soit simplement absent du portfolio anglais, sans repli de langue, afin de ne jamais publier du français sur la version anglaise.
82. En tant que visiteur, je veux un portfolio agréable à regarder et rapide, afin d'avoir envie de le parcourir.

### Exploitation

83. En tant qu'exploitant, je veux qu'un commit sur la branche principale parte en production automatiquement, afin de ne pas avoir de geste de livraison.
84. En tant qu'exploitant, je veux que GitHub n'ait **aucun accès entrant** au VPS, afin qu'aucune clé d'accès permanente à la production ne réside chez un tiers.
85. En tant qu'exploitant, je veux que chaque migration soit répétée sur une restauration de la dernière sauvegarde avant d'être appliquée, afin d'exercer migration et restauration d'un même geste.
86. En tant qu'exploitant, je veux qu'une migration ne retire jamais ce que la version précédente utilise encore, afin que le retour arrière consiste uniquement à remettre les images précédentes.
87. En tant qu'exploitant, je veux qu'une vérification de santé échouée déclenche le retour aux images précédentes, afin qu'une livraison ratée ne laisse pas l'application indisponible.
88. En tant qu'exploitant, je veux une trace lisible de chaque déploiement sur le VPS et une alerte en cas d'échec, afin de savoir ce qui s'est passé sans interface GitHub.
89. En tant qu'exploitant, je veux des sauvegardes Restic chiffrées chez un fournisseur **différent** d'OVH, couvrant PostgreSQL, les objets S3 et la base et la configuration Authentik, afin de survivre à la perte du fournisseur.
90. En tant qu'exploitant, je veux que la clé de déchiffrement Restic ne quitte jamais la machine, afin que des documents personnels ne soient jamais déchiffrés ailleurs.
91. En tant qu'exploitant, je veux un environnement local fidèle et pas d'environnement de recette, afin de ne pas entretenir une troisième installation.

## Implementation Decisions

### Découpe en modules

Le monorepo Nx héberge : deux applications Angular (tableau de bord privé, portfolio public), une API NestJS, un worker, et une bibliothèque de contrats partagés.

Modules applicatifs :

- **Socle** — accès aux données, garde d'**Espace**, session, contrats partagés.
- **Calendrier** — possède l'**Événement** et sa récurrence.
- **Agenda** — vue en lecture seule, ne connaît aucun domaine.
- **Sport** — possède **Séance** et **Objectif**.
- **Alimentation** — module unique regroupant recettes, planning, courses, produits et stock, tous construits autour d'**Ingrédient** et d'**Unité canonique** (choix explicite du développeur : trois modules auraient partagé leur cœur).
- **Projets** — possède **Projet** et **Présentation publique**.
- **Portfolio** — lecture publique, **Pages de contenu**, **CV**.
- **Tableau de bord** — composition des widgets et calcul des **À faire**.
- **Barre de commande** — catalogue, résolution d'intention, préremplissage.
- **Exploitation** — agent de déploiement, sauvegardes, supervision.

Conformément à l'ADR 0016, chaque module démarre **plat** (contrôleur, service, accès aux données, DTO). On n'extrait une couche domaine que là où une vraie règle apparaît — c'est exactement ce que sont les modules profonds ci-dessous.

### Modules profonds à extraire

Chacun est une unité pure ou quasi pure, à interface étroite, testable sans base ni HTTP :

- **Moteur de récurrence** — `(règle, exceptions, période) → occurrences`. Aucune occurrence n'est stockée. Modèle iCalendar : une règle sur l'**Événement**, plus des exceptions (occurrence supprimée, occurrence déplacée ou modifiée).
- **Résolveur d'ingrédients** — `(libellé libre) → Ingrédient | inconnu`. Encapsule les **Alias** ; un rattachement décidé une fois n'est plus jamais redemandé.
- **Convertisseur de quantités** — `(quantité, unité source, Ingrédient) → quantité en Unité canonique`. Encapsule les conversions dimensionnelles et le facteur pièce↔poids validé par ingrédient. Échoue explicitement plutôt que d'approximer.
- **Consolidateur de courses** — `(Repas planifiés, Recettes, Stock domestique, Produits) → Articles de courses`. Le cœur métier des courses : agrégation par ingrédient, conversion, déduction du stock, choix du **Produit préféré** et arrondi au conditionnement. Aucune écriture.
- **Machine à Tours de génération** — `(Planning, décisions) → état suivant`. Fait respecter la règle : on ne relance que lorsque **tous** les repas ont été approuvés ou refusés, et le tour suivant ne porte que sur les refusés.
- **Recaleur de stock** — `(mouvement) → nouvel état du Stock domestique`. Trois entrées seulement : clôture de liste (quantité achetée), **Repas cuisiné** (quantité réellement utilisée), édition manuelle. Une ligne par ingrédient, date de péremption la plus proche conservée.
- **Calculateur d'À faire** — `(résumés des modules) → À faire`. Pur, sans stockage ; chaque module fournit son résumé.
- **Générateur du catalogue d'actions** — `(OpenAPI + annotations) → catalogue typé`, exécuté au build.
- **Résolveur d'intention** — `(phrase, catalogue) → action préremplie | échec explicite`. L'appel au modèle est derrière une interface remplaçable par un double dans les tests.

### Décisions structurantes (issues des ADR)

- **Objets datés** — pas de table `Event` générique. Chaque module possède son entité datée et implémente le contrat `AgendaContributor`, qui reste **étroit** : source, identité d'origine, date de début, date de fin optionnelle, intitulé, statut. Aucun attribut métier n'y transite. Les widgets hétérogènes du tableau de bord **ne passent pas** par ce port : chaque module expose son propre endpoint de résumé (ADR 0011).
- **Espace** — colonne obligatoire sur chaque enregistrement, jamais déduite d'un contexte. Le filtrage est appliqué dans une **extension Prisma**, pour toutes les requêtes. Aucun service n'ajoute de filtre à la main ; en trouver un signale que le mécanisme central a été contourné (ADR 0014, 0016).
- **Authentification** — Authentik dès le VPS. L'API est un client OIDC ordinaire (authorization code) et émet **sa propre** session serveur en cookie `HttpOnly`. Une table `User` locale est liée au sujet Authentik. Authentik répond « qui tu es », l'application répond « ce que tu peux voir ». Comptes créés à la main (ADR 0015).
- **Liste de courses** — produire une liste la **fige**. Les évolutions ultérieures du planning ne la modifient jamais ; l'écart est signalé et donne lieu à une liste de complément. Articles cochés et ajouts manuels sont sacrés (ADR 0012).
- **Stock domestique** — quantitatif et déclaratif. Tout ce qui est acheté y entre. Trois voies de recalage. Une ligne par ingrédient, pas de lots. Un stock faux est un incident normal, corrigé à la main (ADR 0013).
- **À faire** — ni entité Tâche, ni entité Notification, ni centre de notifications. Une **Échéance** est un **Événement** portant une catégorie dédiée ; un « rappel » est un délai porté par l'événement. À rouvrir le jour où une notification doit **sortir** de l'application (ADR 0017).
- **Barre de commande** — prépare une action préremplie, ne l'exécute jamais sans confirmation, **sans exception**. Elle agit et navigue, elle ne répond pas. Catalogue **fermé**, généré au build depuis les endpoints annotés via l'OpenAPI déjà produit ; un endpoint non annoté est invisible. Commande non comprise : le dire, proposer l'écran le plus proche, journaliser la phrase verbatim — ce journal est la file de travail (ADR 0018).
- **Portfolio** — rédigé, pas généré. Pas d'entité `Experience`, `Skill`, `CaseStudy` ni `Publication`. CV = PDF téléversé. Un seul portfolio, deux langues, pas de profils. Langue initiale depuis `Accept-Language`, jamais par géolocalisation IP. Aucun repli entre langues (ADR 0019).
- **Sport** — une **Séance** porte prévu et réalisé plus un statut. Pas de `TrainingPlan`, `TrainingWeek` ni `TrainingResult` ; un **Objectif** remplace le plan (ADR 0022).
- **Récurrence** — règle plus exceptions, occurrences calculées à la lecture.
- **Déploiement** — automatique sur la branche principale, qui devient une branche de livraison. Exécution **tirée** : GitHub construit, teste et pousse les images sur GHCR, sans aucun accès entrant au VPS ; un agent local enchaîne restauration → répétition de la migration → récupération des images → migration → redémarrage → vérification de santé → retour arrière (ADR 0023). L'agent est versionné dans le dépôt et sa panne est un incident.
- **Migrations** — expand/contract. Une migration ne retire jamais ce que la version précédente utilise encore ; un renommage prend trois temps. Le retour arrière ne touche jamais la base (ADR 0024).
- **Environnements** — local et production uniquement ; la restauration d'une sauvegarde sert de banc d'essai (ADR 0021).
- **Sauvegardes** — Restic chez un fournisseur différent d'OVH, couvrant PostgreSQL, les objets S3 et la base et la configuration Authentik (ADR 0020).

### Contrats et schéma

- Contrats partagés : `AgendaContributor` (un module → ses `AgendaItem` sur une période), le résumé de module consommé par le tableau de bord, et le catalogue d'actions.
- Entités V1 : `User`, `Household`, `Event`, `TrainingSession`, `TrainingGoal`, `Ingredient`, `IngredientAlias`, `Recipe`, `MealPlan`, `MealPlanEntry`, `MealWish`, `FoodPreference`, `GenerationRound`, `PantryItem`, `Product`, `ShoppingList`, `ShoppingListItem`, `Project`, `PublicPresentation`, `PageContent`, plus la trace des générations IA et le journal des commandes non comprises.
- Chaque entité porte un **Espace**, sauf celles qui sont par nature globales (catalogue d'**Ingrédients**, **Produits**, `PageContent`).
- L'IA (génération de planning, résolution d'intention) passe par une interface applicative unique ; le fournisseur est un détail d'infrastructure remplaçable.

## Testing Decisions

Un bon test décrit un **comportement observable** depuis l'extérieur du module : mêmes entrées, même sortie, sans connaître la structure interne. Un test qui casse lors d'un renommage de méthode privée ou d'un déplacement de fichier teste la mauvaise chose. Les modules profonds ci-dessus ont précisément été extraits pour que leurs règles soient testables sans base, sans HTTP et sans modèle de langage.

Trois familles de tests sont dans le périmètre de ce PRD :

**1. Les modules profonds** (tests unitaires, sans infrastructure)

- **Moteur de récurrence** — occurrence supprimée, occurrence déplacée hors de sa période, changement de règle reflété immédiatement, bornes de période inclusives/exclusives, changement d'heure.
- **Résolveur d'ingrédients** — libellé inconnu signalé, alias rattaché puis reconnu, deux libellés proches restant deux ingrédients distincts.
- **Convertisseur de quantités** — pièces plus grammes pour un même ingrédient, échec explicite quand aucun facteur n'est validé, absence de conversion silencieuse entre dimensions.
- **Consolidateur de courses** — agrégation de plusieurs recettes sur un même ingrédient, déduction du stock, besoin entièrement couvert par le stock (aucun article produit), arrondi au conditionnement du **Produit préféré**, article valide sans produit.
- **Machine à Tours de génération** — relance refusée tant qu'un repas n'a pas été statué, tour suivant portant uniquement sur les refusés, planning arrêté quand tout est approuvé.
- **Recaleur de stock** — clôture de liste avec quantité achetée ≠ quantité de la recette, **Repas cuisiné** avec quantité réelle, édition manuelle, conservation de la date de péremption la plus proche au rachat, stock qui ne devient jamais négatif silencieusement.
- **Calculateur d'À faire** — chaque situation produit son **À faire**, et il disparaît quand la situation change.
- **Résolveur d'intention** — action attendue pour une phrase connue (modèle doublé), échec explicite pour une phrase hors catalogue, phrase journalisée verbatim, action jamais exécutée sans confirmation.
- **Générateur du catalogue** — endpoint annoté présent, endpoint non annoté absent.

**2. La garde d'Espace** (tests d'intégration sur base réelle — priorité la plus haute)

Le test porte sur le **mécanisme central**, pas sur chaque endpoint pris séparément (ADR 0016) :

- un utilisateur ne lit, ne modifie ni ne supprime jamais un enregistrement de l'**Espace personnel** de l'autre, y compris en devinant un identifiant ;
- les deux utilisateurs voient les mêmes données de l'**Espace foyer** ;
- une écriture sans **Espace** est refusée ;
- un module refuse un **Espace** qu'il n'accepte pas ;
- une action de la **barre de commande** est soumise au même filtrage, sans chemin d'accès dérobé.

**3. Le chemin public** (tests d'intégration)

- le **Portfolio** ne sert que des contenus à l'état « publié » ;
- aucune note privée de **Projet** n'apparaît dans une réponse publique ;
- un projet sans présentation anglaise est absent du portfolio anglais, sans repli ;
- la langue initiale suit `Accept-Language` ;
- aucun endpoint public n'expose de donnée portant un **Espace** personnel.

**Prior art** : aucune — le dépôt ne contient encore aucun code. Les conventions de test seront donc posées par la première tranche livrée et devront être reprises telles quelles ensuite. Le socle de test est à mettre en place avec le socle applicatif : exécution des tests d'intégration sur une base jetable, et jeu de données minimal couvrant les trois **Espaces**.

## Out of Scope

- **Les parcours bout-en-bout** (planning → liste → clôture → stock → repas cuisiné) ne sont pas couverts par des tests dans ce PRD : décision explicite du développeur, les modules profonds portant déjà les règles.
- **Modules post-V1** : documents, finances, immobilier. Ils produiront des objets datés et implémenteront `AgendaContributor` le moment venu, mais ne sont pas instruits.
- **Entités retirées du périmètre** : `Task`, `Notification`, `Experience`, `Skill`, `CaseStudy`, `Publication`, `TrainingPlan`, `TrainingWeek`, `TrainingResult`.
- **Notifications sortantes** (e-mail, push) : hors périmètre, et leur arrivée rouvrira l'ADR 0017.
- **Centre de notifications, états lu/non lu, historique de ce qui a été signalé.**
- **Profils de portfolio** multiples et **CV structuré ou généré**.
- **Gestion de lots** dans le **Stock domestique**, et tout recalcul automatique du stock.
- **Régénération d'un repas isolé** au fil de l'eau, hors **Tour de génération**.
- **Environnement de recette**, déploiement manuel, et migrations descendantes.
- **Homelab** (Garage, Tailscale, Grafana/Prometheus/Loki) : la cible reste le VPS OVH pour la V1.
- **Inscription ouverte, gestion de rôles, plus de deux utilisateurs.**
- **Application mobile native.**

## Further Notes

- Le périmètre de la V1 est assumé comme plus large que le §29 de la note produit initiale : deux comptes de plein droit, Authentik, tests de non-exposition, catalogue **Produit**, **Stock domestique** avec péremptions, traçabilité IA et barre de commande s'y ajoutent. Le projet étant purement personnel, une livraison unique n'est pas un problème ; le découpage en tranches se fera au niveau des issues.
- La note produit initiale porte une bannière d'avertissement et dix-huit renvois vers les ADR. **En cas de désaccord entre la note et un ADR, l'ADR l'emporte.**
- La numérotation des ADR démarre à 0011 : les numéros 001 à 010 sont occupés par les décisions de stack du §25 de la note.
- Le catalogue d'actions de la barre de commande **démarre petit et grossit par la preuve d'usage**. Livrer un écran n'oblige pas à annoter ses endpoints le même jour ; on annote quand le journal des commandes non comprises le justifie.
- Ambiguïté restante signalée dans le glossaire : le mot **« tâche »** ne désigne rien en V1.
- Restent à instruire, hors de ce PRD : les conventions d'API, les maquettes, et le jeu d'endpoints annotés initial.

