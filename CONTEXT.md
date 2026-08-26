# Personal OS

Application web privée qui centralise la vie personnelle et professionnelle d'un utilisateur unique : organisation, repas, documents, finances, immobilier, projets, et un portfolio public.

Ce document est un **glossaire**, pas une spécification. Il fixe le vocabulaire du domaine. Aucun détail d'implémentation ne doit y figurer.

**Convention de langue** : la prose, l'interface et les échanges se font en français ; les identifiants de code (entités, champs, endpoints) sont en anglais. Chaque terme ci-dessous donne les deux formes.

## Language

### Ligne du temps

Cinq modules produisent des objets datés. Ce ne sont pas la même chose et ils ne partagent aucune table.

**Événement** (`Event`) :
Une entrée du calendrier saisie pour elle-même — rendez-vous, anniversaire, échéance administrative. C'est le seul objet daté qui n'appartienne à aucun autre module.
_Éviter_ : « rendez-vous », « tâche », et l'emploi d'« événement » comme mot générique pour tout ce qui a une date.

**Séance** (`TrainingSession`) :
Une unité d'entraînement sportif, qui porte **à la fois** ce qui était prévu et ce qui a été réalisé, plus un statut. Une sortie non planifiée est une **Séance** créée déjà réalisée, sans prévu ; une séance manquée garde son prévu et reste sans réalisé. Il n'existe pas d'objet « résultat » distinct. Une **Séance** n'est pas un **Événement**.
_Éviter_ : « entraînement » pour désigner une occurrence précise, « résultat », « performance ».

**Objectif** (`TrainingGoal`) :
Ce vers quoi les **Séances** convergent : une course, une date, une intention d'allure ou de distance. Il n'existe **pas** d'entité « plan d'entraînement » — un plan, c'est l'ensemble des **Séances** qui mènent à un **Objectif**, et rien d'autre.
_Éviter_ : « plan », « programme », « cycle », « bloc ».

**Repas planifié** (`MealPlanEntry`) :
L'affectation d'une **Recette** (ou d'un simple intitulé) à une date, à un moment de la journée et à un ensemble de **Participants**. Le nombre de portions découle des participants. Un **Repas planifié** n'est pas un **Événement**.
_Éviter_ : « repas » tout court quand on désigne l'entrée du planning.

**Participant** :
Une personne attendue à un **Repas planifié**. Par défaut, tout le **Foyer** participe. Les **Préférences alimentaires** appliquées à la génération sont celles des participants de ce repas-là — l'aversion d'un absent ne s'applique pas, l'allergie d'un participant ne se contourne jamais.
_Éviter_ : « convive », « invité », « personne » employés comme synonymes flous.

**Agenda** (`AgendaView`) :
La vue en lecture seule qui fusionne, pour une période donnée, les **Événements**, les **Séances** et les **Repas planifiés**. Ce n'est pas une entité stockée : rien ne s'y écrit, rien n'y a d'identité propre.
_Éviter_ : « calendrier » pour désigner cette vue (voir ci-dessous).

**Entrée d'agenda** (`AgendaItem`) :
La référence à un objet daté telle qu'elle apparaît dans l'**Agenda** : sa source, son identité d'origine, sa date et son intitulé. Une **Entrée d'agenda** n'est jamais l'objet lui-même et ne porte aucun de ses attributs métier.
_Éviter_ : « item », « bloc », « carte ».

**Calendrier** (`Calendar`) :
Le module qui possède les **Événements**. Le mot ne désigne ni l'**Agenda**, ni l'écran mensuel de l'interface.
_Éviter_ : employer « calendrier » pour la vue agrégée ou pour l'écran.

### Foyer et partage

**Foyer** (`Household`) :
Les personnes qui vivent ensemble et pour qui on planifie les repas et les courses. Il n'existe qu'un seul **Foyer**.
_Éviter_ : « famille », « groupe », « équipe ».

**Compte** (`User`) :
L'un des deux membres du **Foyer**, tel que l'application le connaît. Il est apparié à une identité du **Fournisseur d'identité** et porte l'**Espace personnel** de cette personne. Les comptes ne s'ouvrent pas : ils sont admis, un par un, et il n'y en a que deux.
_Éviter_ : « utilisateur » quand on désigne la rangée, « profil », « membre ».

**Fournisseur d'identité** (Authentik) :
Le service extérieur qui répond à « qui es-tu », et à cela seulement. Ce qu'un **Compte** peut voir n'est jamais de son ressort : c'est l'**Espace** qui le dit.
_Éviter_ : « SSO », « annuaire », et l'idée qu'il détiendrait des droits.

**Espace** (`Scope`) :
Le compartiment auquel appartient une donnée, et la seule chose qui détermine qui peut la voir. Il en existe trois : un **Espace personnel** par utilisateur, et l'**Espace foyer**. Chaque enregistrement porte son espace ; chaque module déclare les espaces qu'il accepte (les repas, les courses et le stock sont toujours dans l'**Espace foyer** ; les finances et les documents toujours dans un **Espace personnel** ; le calendrier accepte les deux).
_Éviter_ : « partage », « visibilité » (réservé au public — voir **Visibilité**), « permission », « propriétaire ».

**État de publication** (`publicationState`) :
Le fait qu'un contenu publiable soit sorti sur Internet ou non : non publié, prêt à publier, publié. Il ne concerne que les objets destinés au portfolio (projets, études de cas, expériences, compétences) — les autres n'en portent pas du tout. Il ne dit **jamais** qui, dans le foyer, peut voir la donnée : c'est le rôle de l'**Espace**.
_Éviter_ : « visibilité », `PRIVATE`, `INTERNAL` — cette échelle est abandonnée, elle empiétait sur l'**Espace**.

**Préférence alimentaire** (`FoodPreference`) :
Une contrainte ou un goût rattaché à **une personne** : allergie, aliment exclu, aliment peu apprécié. Les préférences de toutes les personnes concernées par un repas s'appliquent à sa génération. Une allergie n'est pas une aversion : elle ne se contourne jamais.
_Éviter_ : « régime », « restriction » employés indifféremment pour l'allergie et le goût.

### Repas et courses

**Ingrédient** (`Ingredient`) :
Une entrée canonique du catalogue alimentaire, désignée par un identifiant stable et une **Unité canonique**. Deux libellés qui ne se cuisinent ni ne s'achètent de la même façon sont deux **Ingrédients** distincts (l'oignon jaune et l'oignon rouge ; la tomate fraîche et la tomate en conserve).
_Éviter_ : « aliment », « denrée ».

**Alias d'ingrédient** (`IngredientAlias`) :
Un libellé reconnu comme désignant un **Ingrédient** donné (« belles tomates », « tomates concassées »). Les alias sont la mémoire du système : une fois un libellé rattaché, il ne redemande plus.
_Éviter_ : « synonyme », « variante ».

**Unité canonique** (`canonicalUnit`) :
L'unité dans laquelle les quantités d'un **Ingrédient** sont toujours consolidées, quelle que soit l'unité employée par la recette. Un **Ingrédient** peut porter un facteur de conversion validé une fois pour toutes (poids moyen à la pièce). L'unité d'affichage dans la liste de courses peut différer de l'unité canonique.
_Éviter_ : parler d'« unité » sans préciser laquelle — recette, canonique ou affichage.

**Planning de repas** (`MealPlan`) :
L'ensemble des **Repas planifiés** d'une semaine donnée, et l'objet sur lequel porte la génération par l'IA puis la validation.
_Éviter_ : « calendrier des repas » — le **Calendrier** est un autre module —, « menu », « semaine ».

**Recette** (`Recipe`) :
Une préparation réutilisable : des **Ingrédients** en quantités, des étapes, un nombre de portions de référence. Une **Recette** ne connaît que des **Ingrédients**, jamais des **Produits**.
_Éviter_ : « plat », « repas » (voir **Repas planifié**).

**Tour de génération** (`GenerationRound`) :
Un cycle complet du **Planning de repas** : l'IA propose, l'utilisateur statue sur **chacun** des repas — approuvé ou refusé —, puis relance. Le tour suivant ne régénère que les repas refusés. Le planning est arrêté quand tous les repas sont approuvés. On ne régénère jamais un repas isolément au fil de l'eau.
_Éviter_ : « itération », « relance », « regénération partielle ».

**Souhait** (`MealWish`) :
Une **Recette** ou une envie déposée avant la génération, que le **Planning de repas** de la semaine visée doit honorer. C'est une contrainte d'entrée de la génération, pas une proposition de l'IA.
_Éviter_ : « demande », « favori », « envie ».

**Repas cuisiné** :
Un **Repas planifié** que l'utilisateur a déclaré réalisé, en indiquant les quantités **réellement** utilisées — pas celles de la **Recette**. C'est la seule chose qui fait baisser le **Stock domestique** par consommation.
_Éviter_ : « repas terminé », « repas consommé ».

**Stock domestique** (`PantryItem`) :
La quantité d'un **Ingrédient** détenue à la maison, exprimée en **Unité canonique** et assortie le cas échéant d'une date de péremption. Il est **déclaratif** : il représente ce que l'utilisateur a déclaré, jamais une vérité garantie. Il monte à la clôture d'une liste de courses, baisse à la déclaration d'un **Repas cuisiné**, et se corrige à la main à tout moment.
_Éviter_ : « inventaire », « placard », « garde-manger ».

**Produit** (`Product`) :
Une façon concrète d'acheter un **Ingrédient** : marque, conditionnement, forme (frais, surgelé, conserve). Un **Ingrédient** peut avoir plusieurs **Produits**, dont un **Produit préféré** repris automatiquement dans la liste. Un **Produit** n'apparaît jamais dans une recette : on cuisine des **Ingrédients**, on achète des **Produits**.
_Éviter_ : « référence », « article » (voir **Article de courses**), et l'emploi de « produit » pour désigner l'ingrédient.

**Article de courses** (`ShoppingListItem`) :
Une ligne de la liste de courses : un **Ingrédient** (obligatoire), la quantité consolidée en **Unité canonique**, et éventuellement un **Produit** préféré. Un article sans **Produit** reste parfaitement valide.
_Éviter_ : « item », « ligne », « course ».

### Projets et portfolio

**Projet** (`Project`) :
Un travail personnel ou professionnel suivi dans l'application, avec ses notes, ses liens et ses dépenses. Il vit dans un **Espace personnel** et n'en sort jamais ; il peut porter une **Présentation publique**.
_Éviter_ : « réalisation », « produit », « expérience » (qui désigne un poste occupé).

**Présentation publique** (`PublicPresentation`) :
Le texte d'un **Projet** destiné au **Portfolio**, dans **une** langue donnée. Elle est distincte des notes privées du projet, qui ne sortent jamais. Un projet dont la présentation anglaise manque est simplement absent du portfolio anglais.
_Éviter_ : « description » employé indifféremment pour le privé et le public.

**Portfolio** :
Le site public, unique, disponible en français et en anglais. La langue initiale est déduite du navigateur du visiteur et modifiable par un sélecteur toujours visible. Il ne lit que des **Présentations publiques** à l'**État de publication** « publié ».
_Éviter_ : « profil de portfolio » — il n'y en a qu'un —, « site vitrine », « CV » (voir plus bas).

**Page de contenu** (`PageContent`) :
Le texte rédigé d'une page du **Portfolio** (présentation, expériences, compétences), dans les deux langues, édité depuis le tableau de bord. C'est de la prose, pas une liste d'objets : il n'existe ni entité Expérience, ni entité Compétence.
_Éviter_ : « page statique », « bloc », « section ».

**CV** :
Un document PDF rédigé hors de l'application et téléversé ; l'application se contente de le servir. Le **Portfolio** n'en est pas la transcription : il présente la personne, ses projets, ses compétences et ceux avec qui elle a travaillé.
_Éviter_ : « CV généré », « CV structuré ».

**Échéance** :
Un **Événement** portant une catégorie dédiée (déclaration fiscale, fin de garantie, date limite administrative). Ce n'est pas une entité distincte : il n'existe rien de tel qu'un objet « échéance ».
_Éviter_ : traiter « échéance » comme un concept à part entière.

**À faire** :
Ce que le tableau de bord présente comme requérant l'attention de l'utilisateur. C'est toujours **calculé** à partir de l'état réel des modules — un planning dont des repas attendent une décision, une liste non arrêtée, un ingrédient qui périme, une **Échéance** proche. Rien n'est stocké, rien ne se coche : un « à faire » disparaît parce que la situation qui le produisait a changé.
_Éviter_ : « tâche » — il n'existe aucune entité Tâche —, « rappel », « alerte ».

## Flagged ambiguities

- **« tâche »** : le mot ne désigne rien en V1. Les « tâches à valider » du §7.1 sont des **À faire** calculés ; les « tâches domestiques » du §6.2 n'ont pas d'existence ; les « tâches » de projet du §7.8 attendent que le module Projets soit instruit.

## Dialogues d'exemple

### Ce qui a une date

> **Dev** — Sur l'écran du lundi, je vois « Sortie longue 14 km » et « Poulet basquaise ». Ce sont deux Événements ?
>
> **Domaine** — Non. Le premier est une Séance, le second un Repas planifié. Aucun des deux n'est un Événement.
>
> **Dev** — Mais ils apparaissent bien dans le calendrier.
>
> **Domaine** — Ils apparaissent dans l'Agenda, qui est une vue. Le Calendrier, lui, ne possède que les Événements — mon rendez-vous chez le dentiste, l'anniversaire de ma sœur, la date limite de la déclaration de revenus.
>
> **Dev** — Donc si je déplace la Séance depuis l'Agenda ?
>
> **Domaine** — Tu ne déplaces rien depuis l'Agenda, il est en lecture seule. Tu déplaces la Séance dans le module Sport, et l'Agenda le reflète à la lecture suivante.

### Ce qu'on cuisine et ce qu'on achète

> **Dev** — La liste dit « Tomates concassées, 2 boîtes ». C'est un Ingrédient ou un Produit ?
>
> **Domaine** — L'Article de courses porte l'Ingrédient « tomate en conserve » et une quantité de 800 g. « 2 boîtes » vient du Produit préféré, qui se vend par 400 g. Si je n'avais pas encore choisi de Produit, la ligne dirait juste 800 g — elle resterait valide.
>
> **Dev** — Et la Recette, elle demande quoi ?
>
> **Domaine** — Des Ingrédients, uniquement. Une recette ne connaît pas les marques.
>
> **Dev** — J'en achète deux boîtes, j'en utilise une et demie. Que sait le système ?
>
> **Domaine** — À la clôture de la liste, le Stock domestique monte de 800 g — ce que j'ai acheté, pas ce que la recette demandait. Quand je déclare le Repas cuisiné, je saisis 600 g réellement utilisés. Il reste 200 g, et la semaine suivante la génération le sait.
>
> **Dev** — Et si le compte est faux ?
>
> **Domaine** — Il le sera parfois. Le Stock domestique est déclaratif, pas une vérité. Je le corrige à la main et on n'en parle plus.

### Qui voit quoi

> **Dev** — Elle se connecte : est-ce qu'elle voit ta séance de course de jeudi ?
>
> **Domaine** — Non, ma Séance est dans mon Espace personnel. Elle voit le Planning de repas, la liste de courses et le Stock, qui sont dans l'Espace foyer, plus ce qu'elle a mis dans le sien.
>
> **Dev** — Et « nos vacances en août », c'est dans quel espace ?
>
> **Domaine** — Espace foyer. Le Calendrier accepte les deux, c'est à la création qu'on choisit.
>
> **Dev** — Ton projet publié sur le portfolio est donc dans l'Espace foyer, puisqu'il est visible ?
>
> **Domaine** — Non, tu mélanges deux choses. Il est dans mon Espace personnel — elle ne le voit pas dans l'application. Il est aussi à l'État de publication « publié », donc le monde entier le lit sur Internet. L'Espace dit qui, dans le foyer, y a accès ; l'État de publication dit si c'est sorti dehors.
