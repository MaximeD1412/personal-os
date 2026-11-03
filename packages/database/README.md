# database

Schéma Prisma, `PrismaService` et garde d'Espace (ADR 0016, 0028).

## Tests

- `pnpm exec nx test database` : les tests unitaires (garde, liste des
  modèles, environnement du jeu de démo).
- `pnpm exec nx test-integration database` : le jeu de démo sur une base
  jetable, créée sur `TEST_DATABASE_URL` (ou `DATABASE_URL`) et supprimée à la
  fin.

## Le jeu de démo

`pnpm demo:seed` remet la base désignée par `DATABASE_URL` dans l'état du jeu
de démo : il **vide les données métier** de tous les Espaces, puis sème, module
par module (`src/demo/seeders.ts`). Le staging s'en sert à chaque déploiement
(ADR 0031).

- `DEMO_ACCOUNT_EMAILS` : les deux Comptes réels admis par Authentik, séparés
  par une virgule. Le semis retrouve leurs `User` (ou les crée, avant leur
  première connexion) et leurs Espaces personnels. Il ne touche jamais au
  Foyer, aux Comptes ni aux Sessions.
- `APP_ENV=production` : la commande refuse de tourner, avant d'ouvrir la base.
- Les dates sont relatives au jour du semis, à l'heure de Paris : deux semis le
  même jour donnent le même état.

La commande tourne sous `ts-node`, qui ne lit pas les alias du dépôt
(`@personal-os/contracts`) : `tsconfig-paths` les résout, depuis la racine
(`TS_NODE_BASEURL`), où la cible Nx `database:demo-seed` est lancée.

Un module nouveau ajoute son semeur : un fichier `src/demo/<module>.ts`, inscrit
dans `SEMEURS`, qui déclare les modèles qu'il possède et les Espaces qu'il
accepte. Un module dont le jeu ne sème rien encore (`ai`, `command-bar`,
`portfolio`) possède quand même ses modèles, dans `modules-without-data.ts` :
le semis les vide.
