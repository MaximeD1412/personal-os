# Un staging de démonstration, sur le même VPS

> **Statut :** accepté. 17 octobre 2026.
> Remplace l'[ADR 0021](0021-pas-de-staging-la-restauration-sert-de-banc-d-essai.md).
> La répétition de chaque migration sur une restauration est conservée :
> elle reste dans la séquence de déploiement de la production.

L'ADR 0021 refusait un staging parce que « l'utilisateur et le développeur sont
la même personne ». Ce n'est plus vrai : les tickets sont implémentés par des
agents et fusionnés sur `develop` sans relecture humaine du code. Il faut donc
un endroit où **voir** ce qui a été fusionné avant de le livrer. C'est là que se
fait la revue visuelle des écrans, et là qu'une régression se remarque avant la
production.

Le staging est un **projet Compose séparé** (`personal-os-staging`) sur le VPS
de production. Il est déployé à chaque merge sur `develop`.

- **Rien n'est partagé avec la production.** Conteneurs, réseau et volumes sont
  ceux du projet, avec son propre PostgreSQL. Les ressources sont plafonnées
  (CPU, mémoire), et le staging peut être arrêté à tout moment sans toucher à la
  prod.
- **Il est servi par le proxy de tête**, sous un sous-domaine dédié, et protégé
  par Authentik comme la prod. Il a son propre client OIDC, avec sa propre URI
  de redirection, et les mêmes deux comptes.
- **Il ne contient que des données de démonstration.** Jamais une copie de la
  production : ce sont des données personnelles, et une restauration en staging
  les ferait vivre une seconde fois sur une installation moins surveillée. La
  base est **réinitialisée à chaque déploiement** à partir du jeu de démo, qui
  couvre les trois Espaces. Le staging montre donc toujours un état connu, et
  le jeu de démo est entretenu, puisqu'il sert tous les jours.
- **Il refuse de démarrer** si son URL de base est celle de la production, ou
  si `APP_ENV` ne vaut pas `staging`.

## Ce que cela coûte

- Une troisième installation à entretenir, que l'ADR 0021 voulait éviter. Ce
  coût est contenu parce que le staging est le **même** Compose que la prod,
  avec un autre fichier d'environnement.
- Le staging ne prouve rien sur les données réelles. C'est la répétition sur
  restauration, dans la séquence de la prod, qui garde ce rôle.
