---
id: INFRA-15
title: "Erreurs de l'API envoyées à Sentry, sans aucune donnée personnelle, pour la surveillance des mises en prod"
epic: INFRA
type: chore
priority: P1
size: S
milestone: M0 Outillage agents et staging
blocked_by: [INFRA-14]
adr: [0023, 0030]
risques: []
revue_visuelle: false
---

## Contexte

Après chaque mise en prod, l'outil partagé `release` surveille la prod pendant
2 h (onglet Versions de la console). Avec une section `release.errors` dans
`.process.json`, il lit aussi les erreurs de la version dans Sentry. Il remet
la version précédente en prod si leur rythme dépasse 3 fois celui de la
version d'avant, et signale dans « À toi » une erreur nouvelle ou revenue.
`release` reconnaît la version par le commit déployé : c'est le `release` des
événements Sentry, et le `revision` qu'INFRA-14 ajoute à `/api/health`.

Le VPS héberge fiches de paie, finances et documents (ADR 0023) : aucun
contenu métier ne doit partir chez Sentry, seulement le type d'erreur, sa pile
et la route.

## État actuel du code

- `packages/api/src/app/erreurs/erreurs.filter.ts` : seul filtre d'exceptions
  (ADR 0030). Une 500 passe par `journaliser()` (`Logger` de Nest), et la
  réponse n'en dit rien.
- `packages/api/src/main.ts` : démarrage de Nest, aucune instrumentation.
- `infra/deploy/docker-compose.prod.yml`, service `api` : `APP_ENV`
  (`production` par défaut) ; aucune variable Sentry.
  `infra/deploy/stack.env.example` n'en documente aucune.
- Aucune dépendance Sentry dans `package.json`.
- INFRA-14 pose `APP_REVISION` (commit complet) dans l'image `api`.

## À faire

- `@sentry/node` dans l'API, initialisé avant Nest (fichier
  `instrument.ts` importé en premier par `main.ts`), seulement si
  `SENTRY_DSN` est défini ; sans DSN, rien n'est envoyé et rien n'est chargé.
  - `release` = `APP_REVISION`, `environment` = `APP_ENV`.
  - Erreurs seulement : `tracesSampleRate` à 0, ni profils ni replays.
  - `sendDefaultPii: false`, `beforeSend` et `beforeBreadcrumb` qui retirent
    le corps des requêtes, les paramètres d'URL, les cookies, les en-têtes
    d'authentification et toute adresse e-mail ou IP ; `user` réduit à rien.
- `ErreursFilter` envoie à Sentry les 500 qu'il journalise (et seulement
  elles : une 4xx est une réponse normale), avec la route gabarit
  (`req.route.path`, jamais l'URL réelle) en étiquette.
- `SENTRY_DSN` passé au service `api` dans `docker-compose.prod.yml` (vide
  par défaut), documenté dans `stack.env.example` et `infra/deploy/README.md`.
- `.process.json` : `release.errors` = `{ "org": "<slug>", "host":
  "https://de.sentry.io", "environment": "production" }`, une fois
  l'organisation créée.
- `docs/pilotage/mep.json` : les gestes ci-dessous (« Pour la prod »).

## Décisions déjà prises

- Sentry SaaS, offre gratuite, région UE (`de.sentry.io`), dans une
  organisation à part, distincte de celle de TGR.
- Erreurs de l'API seulement pour commencer ; le SDK n'envoie aucune donnée
  métier (filtre ci-dessus, testé).
- La version d'un événement est le commit déployé, comme dans TGR : c'est ce
  que `release` filtre.

## Critères d'acceptation

- [ ] Sans `SENTRY_DSN`, l'API démarre et répond comme aujourd'hui, et le SDK n'est pas initialisé.
- [ ] Avec un DSN (transport de test), une erreur levée dans une route produit un événement dont `release` vaut `APP_REVISION` et `environment` vaut `APP_ENV`.
- [ ] Une 404 ou une erreur de validation ne produit aucun événement.
- [ ] L'événement d'une requête qui portait un corps, un cookie, un en-tête `Authorization`, un paramètre d'URL et une adresse e-mail dans le message n'en contient aucun (test sur l'événement filtré).

## Vérification

- `pnpm exec nx test api -- erreurs`, puis `pnpm exec nx test-integration api -- erreurs`.
- `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

- Créer l'organisation Sentry (région UE) et le projet `api` ; cocher
  « Prevent Storing of IP Addresses » et le nettoyage des données sensibles
  côté serveur.
- `SENTRY_DSN` dans le `.env` de prod du VPS.
- Intégration interne « console » en lecture (Project, Issue & Event,
  Organization) ; son jeton dans `SENTRY_AUTH_TOKEN` de
  `~/.config/console/env`, sous un nom propre si l'organisation de TGR y a
  déjà le sien (`tokenEnv` dans `release.errors`).
- Une erreur volontaire après la mise en prod : elle apparaît dans Sentry
  avec le commit déployé, sans e-mail ni IP.

## Hors périmètre

- Les erreurs du tableau de bord et du portfolio (navigateur) : un ticket à
  part si les erreurs de l'API ne suffisent pas.
- Les traces de performance.
- La lecture des erreurs par `release` : elle existe dans l'outil partagé.

## Dépendances

- INFRA-14 : l'image `api` porte `APP_REVISION`.
