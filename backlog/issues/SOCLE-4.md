---
id: SOCLE-4
title: "Front : intercepteur d'erreurs, httpResource, messages de l'API affichés, Événement prérempli par URL"
epic: SOCLE
type: feature
priority: P0
size: M
milestone: M0 Outillage agents et staging
blocked_by: [SOCLE-3]
adr: [0030]
risques: [AG-2]
revue_visuelle: true
---

## Contexte

Côté front, l'ADR 0030 impose : un service de transport par ressource, les lectures par `httpResource`, un intercepteur unique qui traduit toute erreur en `ApiError`, l'affichage du `message` de l'API (jamais un message générique de remplacement) et des `fields` à côté des champs, et des formulaires préremplis par leur URL.

## État actuel du code

- `packages/dashboard/src/app/` : `calendrier.ts` (écran, `erreur = signal<string | null>`, messages génériques « L'Événement n'a pas pu être créé. »), `event.service.ts`, `session.interceptor.ts`, `app.config.ts` (`withInterceptors([sessionInterceptor])`), `app.routes.ts` (`/agenda`, `/calendrier`, `/fil-traceur`).

## À faire

- `erreur-api.interceptor.ts` : transforme toute `HttpErrorResponse` en `ApiError` (si le corps n'est pas une enveloppe valide : `{ status, code: 'network', message: "Le serveur n'a pas répondu." }`) ; enregistré après `sessionInterceptor`.
- `formulaire.ts` (utilitaire) : `prefillDepuisRequete(schema, params)` qui rend `{ valeurs, ignores: string[] }` en validant chaque paramètre par le schéma zod de l'entrée (un champ invalide est ignoré et listé) ; `erreursDeChamp(apiError)` qui rend `Record<path, message>`.
- Calendrier : lectures par `httpResource` ; affichage du `message` de l'API ; erreur de champ sous le champ concerné.
- Nouvelle route `/calendrier/evenements/nouveau` : le formulaire de création, prérempli depuis la requête (`title`, `startsAt`, `endsAt`, `category`, `reminderLeadMinutes`, `scopeId`), avec un bandeau listant les paramètres ignorés ; rien n'est enregistré sans clic sur « Créer ».

## Décisions déjà prises

- L'écran garde son style actuel : la refonte visuelle est UI-4.
- Le bandeau « paramètres ignorés » : « Ces valeurs n'ont pas pu être reprises : … ».

## Critères d'acceptation

- [ ] Une création refusée par l'API affiche le `message` de l'API et l'erreur sous le champ fautif.
- [ ] `/calendrier/evenements/nouveau?title=Dentiste&category=APPOINTMENT` ouvre le formulaire prérempli, sans rien enregistrer.
- [ ] Un paramètre invalide (`category=FOO`) est ignoré et signalé.

## Vérification

- `pnpm exec nx test dashboard` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh '/calendrier' '/calendrier/evenements/nouveau?title=Dentiste&category=APPOINTMENT&category=FOO'`.

## Pour la prod

Rien.

## Hors périmètre

- Les motifs de formulaire du design system : UI-3.

## Dépendances

- SOCLE-3.
